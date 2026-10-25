#![no_std]
// The constructor takes the full configuration and the generated client mirrors it.
#![allow(clippy::too_many_arguments)]
//! # Nema Vault
//!
//! Non-custodial USDT0 yield vault. Users deposit the asset and receive
//! nUSDT0 shares, a classic Stellar asset whose SAC admin is this contract.
//! The vault allocates assets to strategies (XOXNO lending first) and the
//! share price grows as strategies earn.
//!
//! Trust model:
//! - The admin (a multisig account) can pause deposits, tune allocations
//!   within caps, set the peg guard and propose strategies behind a timelock.
//!   No admin path transfers user funds anywhere except into strategies that
//!   survived the timelock, or back to the vault.
//! - `withdraw` is never gated by pause or the peg guard.
//! - `harvest`, `rebalance` and `claim_fees` are permissionless; outcomes are
//!   fully determined by on-chain state.

mod errors;
mod events;
mod guard;
mod math;
mod storage;

#[cfg(test)]
mod test;

use nema_interfaces::strategy::StrategyClient;
use soroban_sdk::{
    contract, contractimpl, panic_with_error,
    token::{StellarAssetClient, TokenClient},
    Address, Env, Vec,
};

pub use errors::VaultError;
pub use storage::{GuardConfig, GuardStatus, PendingStrategy, StrategyInfo};

use events::*;
use math::BPS;

/// Upper bound on the performance fee (20% of profit).
pub const MAX_FEE_BPS: u32 = 2_000;
pub const MAX_STRATEGIES: u32 = 4;
/// Shares minted to the vault itself on the first deposit and never redeemed.
pub const LOCKED_SHARES: i128 = 1_000;
/// One whole share (both tokens use 7 decimals).
pub const ONE_SHARE: i128 = 10_000_000;

#[contract]
pub struct NemaVault;

#[contractimpl]
impl NemaVault {
    pub fn __constructor(
        env: Env,
        admin: Address,
        asset: Address,
        share_token: Address,
        fee_recipient: Address,
        fee_bps: u32,
        buffer_bps: u32,
        strategy_timelock: u64,
    ) {
        let valid = fee_bps <= MAX_FEE_BPS
            && buffer_bps as i128 <= BPS
            && asset != share_token
            && TokenClient::new(&env, &asset).decimals()
                == TokenClient::new(&env, &share_token).decimals();
        if !valid {
            panic_with_error!(&env, VaultError::InvalidConfig);
        }

        storage::set_admin(&env, &admin);
        storage::set_asset(&env, &asset);
        storage::set_share_token(&env, &share_token);
        storage::set_fee_recipient(&env, &fee_recipient);
        storage::set_fee_bps(&env, &fee_bps);
        storage::set_buffer_bps(&env, &buffer_bps);
        storage::set_timelock(&env, &strategy_timelock);
        storage::extend_instance(&env);
    }

    // ---------------------------------------------------------------------
    // User flows
    // ---------------------------------------------------------------------

    /// Deposits `assets` from `from` and mints shares to `from`.
    /// Fails if fewer than `min_shares` would be minted.
    pub fn deposit(env: Env, from: Address, assets: i128, min_shares: i128) -> Result<i128, VaultError> {
        from.require_auth();
        storage::extend_instance(&env);
        if assets <= 0 {
            return Err(VaultError::AmountNotPositive);
        }
        if storage::paused(&env) {
            return Err(VaultError::Paused);
        }
        if guard::is_tripped(&env) {
            return Err(VaultError::GuardTripped);
        }

        let (total_assets, total_shares) = accrue(&env)?;
        let vault = env.current_contract_address();
        let mut shares = math::assets_to_shares(assets, total_assets, total_shares)?;

        if total_shares == 0 {
            if shares <= LOCKED_SHARES {
                return Err(VaultError::FirstDepositTooSmall);
            }
            mint_shares(&env, &vault, LOCKED_SHARES);
            shares -= LOCKED_SHARES;
        }
        if shares <= 0 {
            return Err(VaultError::ZeroShares);
        }
        if shares < min_shares {
            return Err(VaultError::SlippageExceeded);
        }

        asset_client(&env).transfer(&from, &vault, &assets);
        mint_shares(&env, &from, shares);
        storage::set_high_water(&env, &(storage::high_water(&env) + assets));

        Deposited { from, assets, shares }.publish(&env);
        Ok(shares)
    }

    /// Burns `shares` from `from` and pays out the underlying assets.
    /// Always available, even while paused or with the peg guard tripped.
    pub fn withdraw(env: Env, from: Address, shares: i128, min_assets: i128) -> Result<i128, VaultError> {
        from.require_auth();
        storage::extend_instance(&env);
        if shares <= 0 {
            return Err(VaultError::AmountNotPositive);
        }
        if share_client(&env).balance(&from) < shares {
            return Err(VaultError::InsufficientShares);
        }

        let (total_assets, total_shares) = accrue(&env)?;
        let assets = math::shares_to_assets(shares, total_assets, total_shares)?;
        if assets <= 0 {
            return Err(VaultError::AmountNotPositive);
        }
        if assets < min_assets {
            return Err(VaultError::SlippageExceeded);
        }

        burn_shares(&env, &from, shares);
        ensure_liquidity(&env, assets)?;
        asset_client(&env).transfer(&env.current_contract_address(), &from, &assets);
        storage::set_high_water(&env, &(storage::high_water(&env) - assets).max(0));

        Withdrawn { from, assets, shares }.publish(&env);
        Ok(assets)
    }

    // ---------------------------------------------------------------------
    // Permissionless keepers
    // ---------------------------------------------------------------------

    /// Accrues the performance fee and publishes the current share price.
    /// Returns the fee shares minted.
    pub fn harvest(env: Env) -> Result<i128, VaultError> {
        storage::extend_instance(&env);
        let before = storage::fee_shares(&env);
        let (total_assets, total_shares) = accrue(&env)?;
        let fee_shares = storage::fee_shares(&env) - before;
        Harvested {
            total_assets,
            total_shares,
            fee_shares,
        }
        .publish(&env);
        Ok(fee_shares)
    }

    /// Moves one strategy towards its target allocation, keeping the idle
    /// buffer intact. While paused or with the guard tripped, the target is
    /// zero so funds only flow back to the vault. Returns the signed amount
    /// moved into the strategy.
    pub fn rebalance(env: Env, strategy: Address) -> Result<i128, VaultError> {
        storage::extend_instance(&env);
        let (_, info) = find_strategy(&env, &strategy)?;
        let client = StrategyClient::new(&env, &strategy);
        let vault = env.current_contract_address();

        let total_assets = total_assets(&env)?;
        let current = client.balance();
        let defensive = storage::paused(&env) || guard::is_tripped(&env);
        let target = if defensive {
            0
        } else {
            math::bps_of(total_assets, info.target_bps)?
        };

        let delta = if current < target {
            let buffer = math::bps_of(total_assets, storage::buffer_bps(&env))?;
            let available = (idle_assets(&env) - buffer).max(0);
            let amount = (target - current).min(available);
            if amount > 0 {
                asset_client(&env).transfer(&vault, &strategy, &amount);
                client.deposit(&amount);
            }
            amount
        } else if current > target {
            -client.withdraw(&(current - target), &vault)
        } else {
            0
        };

        if delta != 0 {
            Rebalanced {
                strategy,
                delta,
                strategy_balance: client.balance(),
            }
            .publish(&env);
        }
        Ok(delta)
    }

    /// Sends accrued fee shares to the fee recipient.
    pub fn claim_fees(env: Env) -> Result<i128, VaultError> {
        storage::extend_instance(&env);
        let owed = storage::fee_shares(&env);
        if owed <= 0 {
            return Err(VaultError::NothingToClaim);
        }
        let recipient = storage::fee_recipient(&env);
        storage::set_fee_shares(&env, &0);
        share_client(&env).transfer(&env.current_contract_address(), &recipient, &owed);
        FeesClaimed {
            recipient,
            shares: owed,
        }
        .publish(&env);
        Ok(owed)
    }

    /// Keeps the vault instance alive; anyone may call it.
    pub fn extend_ttl(env: Env) {
        storage::extend_instance(&env);
    }

    // ---------------------------------------------------------------------
    // Admin: strategies
    // ---------------------------------------------------------------------

    /// Starts the timelock for adding `strategy`. Users who disagree can exit
    /// before it can be activated.
    pub fn propose_strategy(env: Env, strategy: Address, cap_bps: u32) -> Result<u64, VaultError> {
        require_admin(&env);
        storage::extend_instance(&env);
        if cap_bps == 0 || cap_bps as i128 > BPS {
            return Err(VaultError::InvalidConfig);
        }
        if find_strategy(&env, &strategy).is_ok() {
            return Err(VaultError::StrategyExists);
        }
        if storage::strategies(&env).len() >= MAX_STRATEGIES {
            return Err(VaultError::TooManyStrategies);
        }
        let client = StrategyClient::new(&env, &strategy);
        if client.asset() != storage::asset(&env) || client.vault() != env.current_contract_address() {
            return Err(VaultError::StrategyMismatch);
        }

        let eta = env.ledger().timestamp() + storage::timelock(&env);
        storage::set_pending_strategy(&env, &strategy, Some(&PendingStrategy { cap_bps, eta }));
        StrategyProposed { strategy, cap_bps, eta }.publish(&env);
        Ok(eta)
    }

    pub fn activate_strategy(env: Env, strategy: Address) -> Result<(), VaultError> {
        require_admin(&env);
        storage::extend_instance(&env);
        let pending = storage::pending_strategy(&env, &strategy).ok_or(VaultError::NoPendingStrategy)?;
        if env.ledger().timestamp() < pending.eta {
            return Err(VaultError::TimelockNotElapsed);
        }
        let mut list = storage::strategies(&env);
        if list.len() >= MAX_STRATEGIES {
            return Err(VaultError::TooManyStrategies);
        }

        list.push_back(StrategyInfo {
            address: strategy.clone(),
            cap_bps: pending.cap_bps,
            target_bps: 0,
        });
        storage::set_strategies(&env, &list);
        storage::set_pending_strategy(&env, &strategy, None);
        StrategyAdded {
            strategy,
            cap_bps: pending.cap_bps,
        }
        .publish(&env);
        Ok(())
    }

    pub fn cancel_strategy(env: Env, strategy: Address) -> Result<(), VaultError> {
        require_admin(&env);
        storage::extend_instance(&env);
        storage::pending_strategy(&env, &strategy).ok_or(VaultError::NoPendingStrategy)?;
        storage::set_pending_strategy(&env, &strategy, None);
        Ok(())
    }

    /// Pulls everything out of `strategy` into the vault, then delists it.
    pub fn remove_strategy(env: Env, strategy: Address) -> Result<(), VaultError> {
        require_admin(&env);
        storage::extend_instance(&env);
        let (index, _) = find_strategy(&env, &strategy)?;
        let client = StrategyClient::new(&env, &strategy);

        let balance = client.balance();
        if balance > 0 {
            client.withdraw(&balance, &env.current_contract_address());
        }
        if client.balance() > 0 {
            return Err(VaultError::StrategyNotEmpty);
        }

        let mut list = storage::strategies(&env);
        list.remove(index);
        storage::set_strategies(&env, &list);
        StrategyRemoved { strategy }.publish(&env);
        Ok(())
    }

    /// Sets the allocation `rebalance` aims for. Bounded by the strategy cap,
    /// and all targets plus the idle buffer must fit in 100%.
    pub fn set_allocation(env: Env, strategy: Address, target_bps: u32) -> Result<(), VaultError> {
        require_admin(&env);
        storage::extend_instance(&env);
        let (index, mut info) = find_strategy(&env, &strategy)?;
        if target_bps > info.cap_bps {
            return Err(VaultError::AllocationExceedsCap);
        }
        let mut list = storage::strategies(&env);
        info.target_bps = target_bps;
        list.set(index, info.clone());
        validate_allocations(&list, storage::buffer_bps(&env))?;

        storage::set_strategies(&env, &list);
        AllocationSet {
            strategy,
            target_bps,
            cap_bps: info.cap_bps,
        }
        .publish(&env);
        Ok(())
    }

    /// Caps can only go down without a new timelocked proposal.
    pub fn lower_cap(env: Env, strategy: Address, cap_bps: u32) -> Result<(), VaultError> {
        require_admin(&env);
        storage::extend_instance(&env);
        let (index, mut info) = find_strategy(&env, &strategy)?;
        if cap_bps > info.cap_bps {
            return Err(VaultError::CapIncreaseNotAllowed);
        }
        info.cap_bps = cap_bps;
        info.target_bps = info.target_bps.min(cap_bps);

        let mut list = storage::strategies(&env);
        list.set(index, info.clone());
        storage::set_strategies(&env, &list);
        AllocationSet {
            strategy,
            target_bps: info.target_bps,
            cap_bps,
        }
        .publish(&env);
        Ok(())
    }

    // ---------------------------------------------------------------------
    // Admin: safety & configuration
    // ---------------------------------------------------------------------

    /// Pausing blocks deposits and makes `rebalance` pull funds back.
    /// It never blocks withdrawals.
    pub fn set_paused(env: Env, paused: bool) {
        require_admin(&env);
        storage::extend_instance(&env);
        storage::set_paused(&env, &paused);
        PausedSet { paused }.publish(&env);
    }

    pub fn set_guard(env: Env, config: Option<GuardConfig>) -> Result<(), VaultError> {
        require_admin(&env);
        storage::extend_instance(&env);
        if let Some(cfg) = &config {
            if cfg.max_depeg_bps == 0 || cfg.max_depeg_bps as i128 >= BPS || cfg.max_age == 0 {
                return Err(VaultError::InvalidConfig);
            }
        }
        storage::set_guard(&env, config.as_ref());
        Ok(())
    }

    /// Fees already earned are accrued at the old rate before the change.
    pub fn update_config(env: Env, fee_bps: u32, buffer_bps: u32, fee_recipient: Address) -> Result<(), VaultError> {
        require_admin(&env);
        storage::extend_instance(&env);
        if fee_bps > MAX_FEE_BPS || buffer_bps as i128 > BPS {
            return Err(VaultError::InvalidConfig);
        }
        validate_allocations(&storage::strategies(&env), buffer_bps)?;
        accrue(&env)?;

        storage::set_fee_bps(&env, &fee_bps);
        storage::set_buffer_bps(&env, &buffer_bps);
        storage::set_fee_recipient(&env, &fee_recipient);
        ConfigChanged {
            fee_bps,
            buffer_bps,
            fee_recipient,
        }
        .publish(&env);
        Ok(())
    }

    /// Two-step admin handover: the new admin must accept.
    pub fn propose_admin(env: Env, new_admin: Address) {
        require_admin(&env);
        storage::extend_instance(&env);
        storage::set_pending_admin(&env, Some(&new_admin));
    }

    pub fn accept_admin(env: Env) -> Result<(), VaultError> {
        storage::extend_instance(&env);
        let pending = storage::pending_admin(&env).ok_or(VaultError::NoPendingAdmin)?;
        pending.require_auth();
        storage::set_admin(&env, &pending);
        storage::set_pending_admin(&env, None);
        AdminChanged { admin: pending }.publish(&env);
        Ok(())
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    pub fn asset(env: Env) -> Address {
        storage::asset(&env)
    }

    pub fn share_token(env: Env) -> Address {
        storage::share_token(&env)
    }

    pub fn admin(env: Env) -> Address {
        storage::admin(&env)
    }

    pub fn fee_recipient(env: Env) -> Address {
        storage::fee_recipient(&env)
    }

    pub fn fee_bps(env: Env) -> u32 {
        storage::fee_bps(&env)
    }

    pub fn buffer_bps(env: Env) -> u32 {
        storage::buffer_bps(&env)
    }

    pub fn strategy_timelock(env: Env) -> u64 {
        storage::timelock(&env)
    }

    pub fn is_paused(env: Env) -> bool {
        storage::paused(&env)
    }

    pub fn strategies(env: Env) -> Vec<StrategyInfo> {
        storage::strategies(&env)
    }

    pub fn pending_strategy(env: Env, strategy: Address) -> Option<PendingStrategy> {
        storage::pending_strategy(&env, &strategy)
    }

    pub fn guard(env: Env) -> Option<GuardConfig> {
        storage::guard(&env)
    }

    pub fn guard_status(env: Env) -> GuardStatus {
        guard::status(&env)
    }

    pub fn total_assets(env: Env) -> Result<i128, VaultError> {
        total_assets(&env)
    }

    /// Total shares including fees not yet accrued on-chain.
    pub fn total_shares(env: Env) -> Result<i128, VaultError> {
        Ok(projected(&env)?.1)
    }

    pub fn idle_assets(env: Env) -> i128 {
        idle_assets(&env)
    }

    pub fn high_water(env: Env) -> i128 {
        storage::high_water(&env)
    }

    pub fn unclaimed_fee_shares(env: Env) -> i128 {
        storage::fee_shares(&env)
    }

    /// Value of one whole share in asset units, net of pending fees.
    pub fn share_price(env: Env) -> Result<i128, VaultError> {
        let (total_assets, total_shares) = projected(&env)?;
        math::shares_to_assets(ONE_SHARE, total_assets, total_shares)
    }

    pub fn preview_deposit(env: Env, assets: i128) -> Result<i128, VaultError> {
        let (total_assets, total_shares) = projected(&env)?;
        let shares = math::assets_to_shares(assets, total_assets, total_shares)?;
        Ok(if total_shares == 0 {
            (shares - LOCKED_SHARES).max(0)
        } else {
            shares
        })
    }

    pub fn preview_withdraw(env: Env, shares: i128) -> Result<i128, VaultError> {
        let (total_assets, total_shares) = projected(&env)?;
        math::shares_to_assets(shares, total_assets, total_shares)
    }
}

// -------------------------------------------------------------------------
// Internals
// -------------------------------------------------------------------------

fn require_admin(env: &Env) {
    storage::admin(env).require_auth();
}

fn asset_client(env: &Env) -> TokenClient<'_> {
    TokenClient::new(env, &storage::asset(env))
}

fn share_client(env: &Env) -> TokenClient<'_> {
    TokenClient::new(env, &storage::share_token(env))
}

fn idle_assets(env: &Env) -> i128 {
    asset_client(env).balance(&env.current_contract_address())
}

fn total_assets(env: &Env) -> Result<i128, VaultError> {
    storage::strategies(env)
        .iter()
        .try_fold(idle_assets(env), |acc, s| {
            acc.checked_add(StrategyClient::new(env, &s.address).balance())
                .ok_or(VaultError::ArithmeticOverflow)
        })
}

/// `(total_assets, total_shares)` as they would be right after fee accrual.
fn projected(env: &Env) -> Result<(i128, i128), VaultError> {
    let total_assets = total_assets(env)?;
    let total_shares = storage::total_shares(env);
    let fee = math::fee_shares(
        total_assets,
        total_shares,
        storage::high_water(env),
        storage::fee_bps(env),
    )?;
    Ok((total_assets, total_shares + fee))
}

/// Mints pending performance-fee shares to the vault (claimable by the fee
/// recipient) and advances the high-water mark.
fn accrue(env: &Env) -> Result<(i128, i128), VaultError> {
    let (total_assets, total_shares) = projected(env)?;
    let fee = total_shares - storage::total_shares(env);
    if fee > 0 {
        mint_shares(env, &env.current_contract_address(), fee);
        storage::set_fee_shares(env, &(storage::fee_shares(env) + fee));
    }
    // With no shares outstanding there is nobody to charge; start fresh.
    if total_assets > storage::high_water(env) || total_shares == 0 {
        storage::set_high_water(env, &total_assets);
    }
    Ok((total_assets, total_shares))
}

fn mint_shares(env: &Env, to: &Address, amount: i128) {
    StellarAssetClient::new(env, &storage::share_token(env)).mint(to, &amount);
    storage::set_total_shares(env, &(storage::total_shares(env) + amount));
}

fn burn_shares(env: &Env, from: &Address, amount: i128) {
    share_client(env).burn(from, &amount);
    storage::set_total_shares(env, &(storage::total_shares(env) - amount));
}

/// Makes sure at least `needed` assets sit idle in the vault, pulling from
/// strategies in list order.
fn ensure_liquidity(env: &Env, needed: i128) -> Result<(), VaultError> {
    let vault = env.current_contract_address();
    let mut shortfall = needed - idle_assets(env);

    for info in storage::strategies(env).iter() {
        if shortfall <= 0 {
            break;
        }
        let client = StrategyClient::new(env, &info.address);
        let request = shortfall.min(client.balance());
        if request > 0 {
            shortfall -= client.withdraw(&request, &vault);
        }
    }

    if idle_assets(env) < needed {
        return Err(VaultError::InsufficientLiquidity);
    }
    Ok(())
}

fn find_strategy(env: &Env, strategy: &Address) -> Result<(u32, StrategyInfo), VaultError> {
    storage::strategies(env)
        .iter()
        .enumerate()
        .find(|(_, s)| &s.address == strategy)
        .map(|(i, s)| (i as u32, s))
        .ok_or(VaultError::StrategyNotFound)
}

fn validate_allocations(list: &Vec<StrategyInfo>, buffer_bps: u32) -> Result<(), VaultError> {
    let allocated: u32 = list.iter().map(|s| s.target_bps).sum();
    if allocated as i128 + buffer_bps as i128 > BPS {
        return Err(VaultError::AllocationExceedsTotal);
    }
    Ok(())
}
