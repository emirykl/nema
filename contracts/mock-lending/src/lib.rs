#![no_std]
//! # Mock lending (testnet only)
//!
//! Stand-in for the XOXNO controller while its testnet deployment is
//! unavailable. It implements the exact controller subset Nema calls
//! (`supply`, `withdraw`, `get_collateral_amount`, `account_exists`,
//! `get_pool_address`) so `nema-strategy-xoxno` runs unchanged against it.
//!
//! Supplied balances grow with a supply index at an admin-set APR. Interest
//! is paid out of a reserve the admin funds; there are no borrowers. Acts as
//! controller and pool in one contract.

use nema_interfaces::xoxno::HubAssetKey;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token::TokenClient,
    Address, Env, Vec,
};

const WAD: i128 = 1_000_000_000_000_000_000;
const RAY: i128 = 1_000_000_000_000_000_000_000_000_000;
const BPS: i128 = 10_000;
const SECONDS_PER_YEAR: i128 = 31_536_000;
/// Keeps demo rates within something a lending market could plausibly show.
const MAX_RATE_BPS: u32 = 100_000;

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP: u32 = 60 * DAY_IN_LEDGERS;
const THRESHOLD: u32 = BUMP - DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LendingError {
    UnknownMarket = 1,
    AmountNotPositive = 2,
    NotOwner = 3,
    UnknownAccount = 4,
    InsufficientCollateral = 5,
    InvalidRate = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Account {
    pub owner: Address,
    /// Balance divided by the supply index at deposit time (WAD).
    pub scaled: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Market {
    pub hub_id: u32,
    pub asset: Address,
    pub rate_bps: u32,
    pub index: i128,
    pub last_accrual: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Market,
    NextAccountId,
    Account(u64),
}

#[contract]
pub struct MockLending;

#[contractimpl]
impl MockLending {
    pub fn __constructor(env: Env, admin: Address, hub_id: u32, asset: Address, rate_bps: u32) {
        if rate_bps > MAX_RATE_BPS {
            panic_with_error!(&env, LendingError::InvalidRate);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(
            &DataKey::Market,
            &Market {
                hub_id,
                asset,
                rate_bps,
                index: WAD,
                last_accrual: env.ledger().timestamp(),
            },
        );
        env.storage().instance().set(&DataKey::NextAccountId, &1u64);
        env.storage().instance().extend_ttl(THRESHOLD, BUMP);
    }

    // --- XOXNO-compatible controller surface -----------------------------

    pub fn supply(
        env: Env,
        caller: Address,
        account_id: u64,
        _spoke_id: u32,
        assets: Vec<(HubAssetKey, i128)>,
    ) -> Result<u64, LendingError> {
        caller.require_auth();
        let market = accrue(&env);
        let pool = env.current_contract_address();
        let token = TokenClient::new(&env, &market.asset);

        let (id, mut account) = if account_id == 0 {
            let id: u64 = env.storage().instance().get(&DataKey::NextAccountId).unwrap();
            env.storage().instance().set(&DataKey::NextAccountId, &(id + 1));
            (id, Account { owner: caller.clone(), scaled: 0 })
        } else {
            (account_id, owned_account(&env, account_id, &caller)?)
        };

        for (key, amount) in assets.iter() {
            check_market(&market, &key)?;
            if amount <= 0 {
                return Err(LendingError::AmountNotPositive);
            }
            token.transfer(&caller, &pool, &amount);
            account.scaled += amount * WAD / market.index;
        }

        save_account(&env, id, &account);
        Ok(id)
    }

    pub fn withdraw(
        env: Env,
        caller: Address,
        account_id: u64,
        withdrawals: Vec<(HubAssetKey, i128)>,
        to: Option<Address>,
    ) -> Result<Vec<(HubAssetKey, i128)>, LendingError> {
        caller.require_auth();
        let market = accrue(&env);
        let mut account = owned_account(&env, account_id, &caller)?;
        let to = to.unwrap_or(caller);
        let token = TokenClient::new(&env, &market.asset);

        // Same semantics as XOXNO: duplicates are summed, a zero anywhere
        // means "everything". A single market keeps this to one payout.
        let mut paid = Vec::new(&env);
        if withdrawals.is_empty() {
            return Ok(paid);
        }
        let mut full = false;
        let mut total: i128 = 0;
        for (key, amount) in withdrawals.iter() {
            check_market(&market, &key)?;
            if amount < 0 {
                return Err(LendingError::AmountNotPositive);
            }
            full |= amount == 0;
            total += amount;
        }

        let balance = account.scaled * market.index / WAD;
        let amount = if full { balance } else { total };
        if amount > balance {
            return Err(LendingError::InsufficientCollateral);
        }
        // Burn scaled units rounding up so the pool never under-collects.
        let burn = if amount == balance {
            account.scaled
        } else {
            (amount * WAD + market.index - 1) / market.index
        };
        account.scaled -= burn;
        token.transfer(&env.current_contract_address(), &to, &amount);
        paid.push_back((hub_key(&market), amount));

        if account.scaled == 0 {
            env.storage().persistent().remove(&DataKey::Account(account_id));
        } else {
            save_account(&env, account_id, &account);
        }
        Ok(paid)
    }

    pub fn get_collateral_amount(env: Env, account_id: u64, hub_asset: HubAssetKey) -> i128 {
        let market = current_market(&env);
        if check_market(&market, &hub_asset).is_err() {
            return 0;
        }
        load_account(&env, account_id)
            .map(|a| a.scaled * market.index / WAD)
            .unwrap_or(0)
    }

    pub fn account_exists(env: Env, account_id: u64) -> bool {
        load_account(&env, account_id).is_some()
    }

    pub fn get_pool_address(env: Env) -> Address {
        env.current_contract_address()
    }

    /// Pool view on XOXNO: annual deposit APR in RAY.
    pub fn get_deposit_rate(env: Env, hub_asset: HubAssetKey) -> i128 {
        let market = current_market(&env);
        if check_market(&market, &hub_asset).is_err() {
            return 0;
        }
        market.rate_bps as i128 * (RAY / BPS)
    }

    // --- Mock administration ---------------------------------------------

    pub fn set_rate(env: Env, rate_bps: u32) -> Result<(), LendingError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if rate_bps > MAX_RATE_BPS {
            return Err(LendingError::InvalidRate);
        }
        let mut market = accrue(&env);
        market.rate_bps = rate_bps;
        env.storage().instance().set(&DataKey::Market, &market);
        Ok(())
    }

    pub fn market(env: Env) -> Market {
        current_market(&env)
    }
}

/// Market with the index projected to the current ledger time.
fn current_market(env: &Env) -> Market {
    let mut market: Market = env.storage().instance().get(&DataKey::Market).unwrap();
    let now = env.ledger().timestamp();
    let elapsed = now.saturating_sub(market.last_accrual) as i128;
    market.index += market.index * market.rate_bps as i128 * elapsed / (BPS * SECONDS_PER_YEAR);
    market.last_accrual = now;
    market
}

fn accrue(env: &Env) -> Market {
    let market = current_market(env);
    env.storage().instance().set(&DataKey::Market, &market);
    env.storage().instance().extend_ttl(THRESHOLD, BUMP);
    market
}

fn check_market(market: &Market, key: &HubAssetKey) -> Result<(), LendingError> {
    if key.hub_id != market.hub_id || key.asset != market.asset {
        return Err(LendingError::UnknownMarket);
    }
    Ok(())
}

fn hub_key(market: &Market) -> HubAssetKey {
    HubAssetKey {
        hub_id: market.hub_id,
        asset: market.asset.clone(),
    }
}

fn load_account(env: &Env, id: u64) -> Option<Account> {
    env.storage().persistent().get(&DataKey::Account(id))
}

fn owned_account(env: &Env, id: u64, caller: &Address) -> Result<Account, LendingError> {
    let account = load_account(env, id).ok_or(LendingError::UnknownAccount)?;
    if &account.owner != caller {
        return Err(LendingError::NotOwner);
    }
    Ok(account)
}

fn save_account(env: &Env, id: u64, account: &Account) {
    let key = DataKey::Account(id);
    env.storage().persistent().set(&key, account);
    env.storage().persistent().extend_ttl(&key, THRESHOLD, BUMP);
}
