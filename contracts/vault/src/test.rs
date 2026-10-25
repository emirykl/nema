#![cfg(test)]
extern crate std;

use crate::{GuardConfig, GuardStatus, NemaVault, NemaVaultClient, VaultError, LOCKED_SHARES, ONE_SHARE};
use nema_interfaces::{sep40, strategy::Strategy};
use nema_mock_oracle::{MockOracle, MockOracleClient};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

const UNIT: i128 = ONE_SHARE; // 1 USDT0 = 10^7 stroops
const FEE_BPS: u32 = 1_000;
const BUFFER_BPS: u32 = 500;
const TIMELOCK: u64 = 3_600;

// -------------------------------------------------------------------------
// Minimal strategy: holds the asset idle; yield is simulated by minting.
// -------------------------------------------------------------------------

#[contracttype]
enum Key {
    Vault,
    Asset,
    Broken,
}

#[contract]
pub struct HoldStrategy;

#[contractimpl]
impl HoldStrategy {
    pub fn __constructor(env: Env, vault: Address, asset: Address) {
        env.storage().instance().set(&Key::Vault, &vault);
        env.storage().instance().set(&Key::Asset, &asset);
    }

    /// Simulates the underlying protocol being paused or broken by an
    /// upgrade: every balance and withdraw call fails.
    pub fn set_broken(env: Env, broken: bool) {
        env.storage().instance().set(&Key::Broken, &broken);
    }
}

fn assert_working(env: &Env) {
    if env.storage().instance().get(&Key::Broken).unwrap_or(false) {
        panic!("strategy unavailable");
    }
}

#[contractimpl]
impl Strategy for HoldStrategy {
    fn asset(env: Env) -> Address {
        env.storage().instance().get(&Key::Asset).unwrap()
    }

    fn vault(env: Env) -> Address {
        env.storage().instance().get(&Key::Vault).unwrap()
    }

    fn balance(env: Env) -> i128 {
        assert_working(&env);
        TokenClient::new(&env, &Self::asset(env.clone())).balance(&env.current_contract_address())
    }

    fn deposit(env: Env, _amount: i128) {
        Self::vault(env).require_auth();
    }

    fn withdraw(env: Env, amount: i128, to: Address) -> i128 {
        Self::vault(env.clone()).require_auth();
        assert_working(&env);
        let amount = amount.min(Self::balance(env.clone()));
        TokenClient::new(&env, &Self::asset(env.clone())).transfer(&env.current_contract_address(), &to, &amount);
        amount
    }
}

// -------------------------------------------------------------------------
// Fixture
// -------------------------------------------------------------------------

struct Fixture {
    env: Env,
    admin: Address,
    fee_recipient: Address,
    vault: NemaVaultClient<'static>,
    asset: TokenClient<'static>,
    asset_admin: StellarAssetClient<'static>,
    shares: TokenClient<'static>,
}

impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|l| l.timestamp = 1_000_000);

        let admin = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let asset_sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let share_sac = env.register_stellar_asset_contract_v2(Address::generate(&env));

        let vault_id = env.register(
            NemaVault,
            (
                admin.clone(),
                asset_sac.address(),
                share_sac.address(),
                fee_recipient.clone(),
                FEE_BPS,
                BUFFER_BPS,
                TIMELOCK,
            ),
        );
        StellarAssetClient::new(&env, &share_sac.address()).set_admin(&vault_id);

        Fixture {
            vault: NemaVaultClient::new(&env, &vault_id),
            asset: TokenClient::new(&env, &asset_sac.address()),
            asset_admin: StellarAssetClient::new(&env, &asset_sac.address()),
            shares: TokenClient::new(&env, &share_sac.address()),
            admin,
            fee_recipient,
            env,
        }
    }

    fn user(&self, balance: i128) -> Address {
        let user = Address::generate(&self.env);
        self.asset_admin.mint(&user, &balance);
        user
    }

    fn add_strategy(&self, target_bps: u32) -> Address {
        let strategy = self
            .env
            .register(HoldStrategy, (self.vault.address.clone(), self.asset.address.clone()));
        self.vault.propose_strategy(&strategy, &10_000);
        self.advance(TIMELOCK);
        self.vault.activate_strategy(&strategy);
        self.vault.set_allocation(&strategy, &target_bps);
        strategy
    }

    fn advance(&self, seconds: u64) {
        self.env.ledger().with_mut(|l| l.timestamp += seconds);
    }

    fn oracle(&self) -> (MockOracleClient<'static>, sep40::Asset) {
        let id = self.env.register(MockOracle, (self.admin.clone(), 14u32));
        let oracle = MockOracleClient::new(&self.env, &id);
        let asset = sep40::Asset::Other(symbol_short!("USDT0"));
        oracle.set_price(&asset, &100_000_000_000_000);
        self.vault.set_guard(&Some(GuardConfig {
            oracle: id,
            asset: asset.clone(),
            max_depeg_bps: 100,
            max_age: 3_600,
        }));
        (oracle, asset)
    }
}

// -------------------------------------------------------------------------
// Deposits, withdrawals and share math
// -------------------------------------------------------------------------

#[test]
fn first_deposit_locks_shares_and_mints_one_to_one() {
    let f = Fixture::new();
    let user = f.user(1_000 * UNIT);

    let shares = f.vault.deposit(&user, &(1_000 * UNIT), &0);

    assert_eq!(shares, 1_000 * UNIT - LOCKED_SHARES);
    assert_eq!(f.shares.balance(&user), shares);
    assert_eq!(f.shares.balance(&f.vault.address), LOCKED_SHARES);
    assert_eq!(f.vault.total_shares(), 1_000 * UNIT);
    assert_eq!(f.vault.total_assets(), 1_000 * UNIT);
    assert_eq!(f.vault.share_price(), UNIT);
}

#[test]
fn first_deposit_must_exceed_locked_shares() {
    let f = Fixture::new();
    let user = f.user(UNIT);
    assert_eq!(
        f.vault.try_deposit(&user, &LOCKED_SHARES, &0),
        Err(Ok(VaultError::FirstDepositTooSmall))
    );
}

#[test]
fn round_trip_never_returns_more_than_deposited() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let seed = f.user(1_000 * UNIT);
    f.vault.deposit(&seed, &(1_000 * UNIT), &0);
    f.vault.rebalance(&strategy);
    // Awkward exchange rate.
    f.asset_admin.mint(&strategy, &3_333_333);

    for amount in [1i128, 7, 999, UNIT + 3, 123_456_789] {
        let user = f.user(amount);
        if let Ok(Ok(shares)) = f.vault.try_deposit(&user, &amount, &0) {
            let back = f.vault.withdraw(&user, &shares, &0);
            assert!(back <= amount, "overpaid: {back} > {amount}");
        }
    }
}

#[test]
fn inflation_attack_is_unprofitable() {
    let f = Fixture::new();
    let attacker = f.user(20_000 * UNIT);
    let victim = f.user(500 * UNIT);
    let attacker_start = f.asset.balance(&attacker);

    // Attacker is first with a dust deposit, then donates to skew the rate.
    f.vault.deposit(&attacker, &(LOCKED_SHARES * 2), &0);
    f.asset.transfer(&attacker, &f.vault.address, &(10_000 * UNIT));

    let victim_shares = f.vault.deposit(&victim, &(500 * UNIT), &0);
    assert!(victim_shares > 0);

    let attacker_shares = f.shares.balance(&attacker);
    f.vault.withdraw(&attacker, &attacker_shares, &0);
    let victim_out = f.vault.withdraw(&victim, &victim_shares, &0);

    assert!(f.asset.balance(&attacker) < attacker_start, "attacker profited");
    // Victim loses well under 1% even against a 20x donation.
    assert!(victim_out * 100 > 500 * UNIT * 99, "victim lost too much: {victim_out}");
}

#[test]
fn deposit_and_withdraw_enforce_slippage_limits() {
    let f = Fixture::new();
    let user = f.user(100 * UNIT);
    assert_eq!(
        f.vault.try_deposit(&user, &(100 * UNIT), &(100 * UNIT)),
        Err(Ok(VaultError::SlippageExceeded))
    );
    let shares = f.vault.deposit(&user, &(100 * UNIT), &0);
    assert_eq!(
        f.vault.try_withdraw(&user, &shares, &(100 * UNIT)),
        Err(Ok(VaultError::SlippageExceeded))
    );
}

#[test]
fn cannot_withdraw_more_shares_than_owned() {
    let f = Fixture::new();
    let alice = f.user(100 * UNIT);
    let bob = f.user(100 * UNIT);
    let shares = f.vault.deposit(&alice, &(100 * UNIT), &0);
    f.vault.deposit(&bob, &(100 * UNIT), &0);

    assert_eq!(
        f.vault.try_withdraw(&alice, &(shares + 1), &0),
        Err(Ok(VaultError::InsufficientShares))
    );
}

#[test]
fn rejects_non_positive_amounts() {
    let f = Fixture::new();
    let user = f.user(UNIT);
    assert_eq!(f.vault.try_deposit(&user, &0, &0), Err(Ok(VaultError::AmountNotPositive)));
    assert_eq!(f.vault.try_withdraw(&user, &-1, &0), Err(Ok(VaultError::AmountNotPositive)));
}

#[test]
fn preview_matches_execution() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let seed = f.user(1_000 * UNIT);
    assert_eq!(f.vault.preview_deposit(&(1_000 * UNIT)), 1_000 * UNIT - LOCKED_SHARES);
    f.vault.deposit(&seed, &(1_000 * UNIT), &0);
    f.vault.rebalance(&strategy);
    f.asset_admin.mint(&strategy, &(10 * UNIT));

    let user = f.user(250 * UNIT);
    let expected = f.vault.preview_deposit(&(250 * UNIT));
    let shares = f.vault.deposit(&user, &(250 * UNIT), &0);
    assert_eq!(shares, expected);
    assert_eq!(f.vault.preview_withdraw(&shares), f.vault.withdraw(&user, &shares, &0));
}

// -------------------------------------------------------------------------
// Yield and fees
// -------------------------------------------------------------------------

#[test]
fn yield_raises_share_price_and_charges_fee_on_profit_only() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let user = f.user(1_000 * UNIT);
    let shares = f.vault.deposit(&user, &(1_000 * UNIT), &0);
    f.vault.rebalance(&strategy);

    f.asset_admin.mint(&strategy, &(10 * UNIT));
    let fee_shares = f.vault.harvest();
    assert!(fee_shares > 0);

    // 10 USDT0 profit, 10% fee: holders keep 9, the fee is worth 1.
    let fee_value = f.vault.preview_withdraw(&fee_shares);
    assert!((fee_value - UNIT).abs() <= 1, "fee value {fee_value}");
    assert_eq!(f.vault.share_price(), UNIT + UNIT * 9 / 1_000);

    // No new profit, no new fee.
    assert_eq!(f.vault.harvest(), 0);

    let out = f.vault.withdraw(&user, &shares, &0);
    assert!(out > 1_008 * UNIT && out < 1_009 * UNIT, "out {out}");

    assert_eq!(f.vault.claim_fees(), fee_shares);
    assert_eq!(f.shares.balance(&f.fee_recipient), fee_shares);
    assert_eq!(f.vault.try_claim_fees(), Err(Ok(VaultError::NothingToClaim)));
}

#[test]
fn late_depositor_does_not_pay_for_earlier_profit() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let early = f.user(1_000 * UNIT);
    f.vault.deposit(&early, &(1_000 * UNIT), &0);
    f.vault.rebalance(&strategy);
    f.asset_admin.mint(&strategy, &(10 * UNIT));

    // Fee is accrued inside deposit, before the newcomer's shares are priced.
    let late = f.user(1_000 * UNIT);
    let shares = f.vault.deposit(&late, &(1_000 * UNIT), &0);
    let out = f.vault.withdraw(&late, &shares, &0);
    assert!(1_000 * UNIT - out <= 2, "late depositor lost {}", 1_000 * UNIT - out);
}

#[test]
fn losses_are_not_charged_until_high_water_is_regained() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let user = f.user(1_000 * UNIT);
    f.vault.deposit(&user, &(1_000 * UNIT), &0);
    f.vault.rebalance(&strategy);

    // Strategy loses 20, then recovers 15: still below the high-water mark.
    TokenClient::new(&f.env, &f.asset.address).burn(&strategy, &(20 * UNIT));
    f.vault.harvest();
    f.asset_admin.mint(&strategy, &(15 * UNIT));
    assert_eq!(f.vault.harvest(), 0);
}

// -------------------------------------------------------------------------
// Pause, peg guard and liquidity
// -------------------------------------------------------------------------

#[test]
fn pause_blocks_deposits_but_never_withdrawals() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let user = f.user(200 * UNIT);
    let shares = f.vault.deposit(&user, &(100 * UNIT), &0);
    f.vault.rebalance(&strategy);

    f.vault.set_paused(&true);
    assert_eq!(f.vault.try_deposit(&user, &(100 * UNIT), &0), Err(Ok(VaultError::Paused)));

    // Withdrawal pulls from the strategy because idle only covers the buffer.
    let out = f.vault.withdraw(&user, &shares, &0);
    assert_eq!(out, 100 * UNIT - LOCKED_SHARES);
}

#[test]
fn rebalance_pulls_everything_back_while_paused() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let user = f.user(100 * UNIT);
    f.vault.deposit(&user, &(100 * UNIT), &0);
    f.vault.rebalance(&strategy);

    f.vault.set_paused(&true);
    f.vault.rebalance(&strategy);
    assert_eq!(f.asset.balance(&strategy), 0);
    assert_eq!(f.vault.idle_assets(), 100 * UNIT);
}

#[test]
fn rebalance_respects_target_and_idle_buffer() {
    let f = Fixture::new();
    let strategy = f.add_strategy(6_000);
    let user = f.user(1_000 * UNIT);
    f.vault.deposit(&user, &(1_000 * UNIT), &0);

    assert_eq!(f.vault.rebalance(&strategy), 600 * UNIT);
    assert_eq!(f.vault.rebalance(&strategy), 0);

    // Target raised to the max allowed with a 5% buffer.
    f.vault.set_allocation(&strategy, &9_500);
    f.vault.rebalance(&strategy);
    assert_eq!(f.vault.idle_assets(), 50 * UNIT);

    f.vault.set_allocation(&strategy, &2_000);
    assert_eq!(f.vault.rebalance(&strategy), -750 * UNIT);
}

#[test]
fn guard_blocks_deposits_on_depeg_and_unwinds_strategies() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let (oracle, asset) = f.oracle();
    let user = f.user(200 * UNIT);
    let shares = f.vault.deposit(&user, &(100 * UNIT), &0);
    f.vault.rebalance(&strategy);
    assert_eq!(f.vault.guard_status(), GuardStatus::Healthy);

    // $0.985 is beyond the 1% threshold.
    oracle.set_price(&asset, &98_500_000_000_000);
    assert_eq!(f.vault.guard_status(), GuardStatus::Depegged);
    assert_eq!(f.vault.try_deposit(&user, &UNIT, &0), Err(Ok(VaultError::GuardTripped)));

    f.vault.rebalance(&strategy);
    assert_eq!(f.asset.balance(&strategy), 0);
    assert!(f.vault.withdraw(&user, &shares, &0) > 0);
}

#[test]
fn guard_treats_stale_price_as_tripped() {
    let f = Fixture::new();
    f.oracle();
    f.advance(3_601);
    assert_eq!(f.vault.guard_status(), GuardStatus::Stale);
    let user = f.user(UNIT * 10);
    assert_eq!(f.vault.try_deposit(&user, &(UNIT * 10), &0), Err(Ok(VaultError::GuardTripped)));
}

#[test]
fn guard_config_is_validated() {
    let f = Fixture::new();
    let (oracle, asset) = f.oracle();
    let bad = GuardConfig {
        oracle: oracle.address.clone(),
        asset,
        max_depeg_bps: 0,
        max_age: 60,
    };
    assert_eq!(f.vault.try_set_guard(&Some(bad)), Err(Ok(VaultError::InvalidConfig)));
    f.vault.set_guard(&None);
    assert_eq!(f.vault.guard_status(), GuardStatus::Disabled);
}

// -------------------------------------------------------------------------
// Strategy governance
// -------------------------------------------------------------------------

#[test]
fn strategies_activate_only_after_timelock() {
    let f = Fixture::new();
    let strategy = f
        .env
        .register(HoldStrategy, (f.vault.address.clone(), f.asset.address.clone()));
    f.vault.propose_strategy(&strategy, &5_000);

    assert_eq!(f.vault.try_activate_strategy(&strategy), Err(Ok(VaultError::TimelockNotElapsed)));
    f.advance(TIMELOCK);
    f.vault.activate_strategy(&strategy);
    assert_eq!(f.vault.strategies().len(), 1);
    assert_eq!(
        f.vault.try_propose_strategy(&strategy, &5_000),
        Err(Ok(VaultError::StrategyExists))
    );
}

#[test]
fn strategy_bound_to_another_vault_or_asset_is_rejected() {
    let f = Fixture::new();
    let other = Address::generate(&f.env);
    let wrong_vault = f.env.register(HoldStrategy, (other.clone(), f.asset.address.clone()));
    let wrong_asset = f.env.register(HoldStrategy, (f.vault.address.clone(), other));
    assert_eq!(
        f.vault.try_propose_strategy(&wrong_vault, &5_000),
        Err(Ok(VaultError::StrategyMismatch))
    );
    assert_eq!(
        f.vault.try_propose_strategy(&wrong_asset, &5_000),
        Err(Ok(VaultError::StrategyMismatch))
    );
}

#[test]
fn allocations_are_bounded_by_caps_and_buffer() {
    let f = Fixture::new();
    let strategy = f.add_strategy(0);
    f.vault.lower_cap(&strategy, &5_000);
    assert_eq!(
        f.vault.try_set_allocation(&strategy, &5_001),
        Err(Ok(VaultError::AllocationExceedsCap))
    );
    assert_eq!(
        f.vault.try_lower_cap(&strategy, &6_000),
        Err(Ok(VaultError::CapIncreaseNotAllowed))
    );

    let second = f.add_strategy(0);
    f.vault.set_allocation(&strategy, &5_000);
    assert_eq!(
        f.vault.try_set_allocation(&second, &4_600),
        Err(Ok(VaultError::AllocationExceedsTotal))
    );
    f.vault.set_allocation(&second, &4_500);
}

#[test]
fn removing_a_strategy_returns_its_funds_to_the_vault() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let user = f.user(100 * UNIT);
    f.vault.deposit(&user, &(100 * UNIT), &0);
    f.vault.rebalance(&strategy);

    f.vault.remove_strategy(&strategy);
    assert_eq!(f.vault.strategies().len(), 0);
    assert_eq!(f.vault.idle_assets(), 100 * UNIT);
    assert_eq!(f.vault.total_assets(), 100 * UNIT);
}

// -------------------------------------------------------------------------
// A strategy that stops answering (protocol paused, broken upgrade)
// -------------------------------------------------------------------------

/// Deposits 100, sends 90 to the strategy, then breaks it.
fn broken_strategy_fixture() -> (Fixture, Address, Address, i128) {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let user = f.user(200 * UNIT);
    let shares = f.vault.deposit(&user, &(100 * UNIT), &0);
    f.vault.rebalance(&strategy);
    HoldStrategyClient::new(&f.env, &strategy).set_broken(&true);
    (f, strategy, user, shares)
}

#[test]
fn unavailable_strategy_can_be_reported_and_withdrawals_reopen() {
    let (f, strategy, user, shares) = broken_strategy_fixture();

    // Before anyone reports it, the vault refuses to price shares on a guess.
    assert_eq!(
        f.vault.try_withdraw(&user, &shares, &0),
        Err(Ok(VaultError::StrategyUnavailable))
    );

    // Anyone can report it; the vault checks the failure itself.
    f.vault.report_unavailable(&strategy);
    assert_eq!(f.vault.impaired_strategies().len(), 1);
    assert_eq!(f.vault.total_assets(), 10 * UNIT);

    // Withdrawals pay out of the cash the vault still holds, pro rata.
    let out = f.vault.withdraw(&user, &shares, &0);
    assert!(out > 9 * UNIT && out <= 10 * UNIT, "got {out}");
    assert_eq!(f.asset.balance(&strategy), 90 * UNIT, "the stuck funds stay put, not lost");

    // New money can't buy in at the written-down price.
    assert_eq!(
        f.vault.try_deposit(&user, &(10 * UNIT), &0),
        Err(Ok(VaultError::StrategyImpaired))
    );
}

#[test]
fn healthy_strategy_cannot_be_reported() {
    let f = Fixture::new();
    let strategy = f.add_strategy(9_000);
    let user = f.user(100 * UNIT);
    f.vault.deposit(&user, &(100 * UNIT), &0);
    f.vault.rebalance(&strategy);

    assert_eq!(
        f.vault.try_report_unavailable(&strategy),
        Err(Ok(VaultError::StrategyHealthy))
    );
    assert_eq!(f.vault.total_assets(), 100 * UNIT);
}

#[test]
fn restored_strategy_counts_again_and_recovery_is_not_charged() {
    let (f, strategy, user, _) = broken_strategy_fixture();
    f.vault.report_unavailable(&strategy);
    let price_down = f.vault.share_price();

    // Still broken: it can't be restored.
    assert_eq!(
        f.vault.try_restore_strategy(&strategy),
        Err(Ok(VaultError::StrategyUnavailable))
    );

    HoldStrategyClient::new(&f.env, &strategy).set_broken(&false);
    f.vault.restore_strategy(&strategy);
    assert_eq!(f.vault.impaired_strategies().len(), 0);
    assert_eq!(f.vault.total_assets(), 100 * UNIT);
    assert!(f.vault.share_price() > price_down);

    // Getting back to the previous high is not profit, so no fee.
    assert_eq!(f.vault.harvest(), 0);
    // And deposits are open again.
    f.vault.deposit(&user, &(10 * UNIT), &0);
}

#[test]
fn rebalance_refuses_an_impaired_strategy() {
    let (f, strategy, _, _) = broken_strategy_fixture();
    f.vault.report_unavailable(&strategy);
    assert_eq!(f.vault.try_rebalance(&strategy), Err(Ok(VaultError::StrategyImpaired)));
}

#[test]
fn admin_can_drop_an_impaired_strategy_without_moving_funds() {
    let (f, strategy, _, _) = broken_strategy_fixture();
    f.vault.report_unavailable(&strategy);

    f.vault.remove_strategy(&strategy);
    assert_eq!(f.vault.strategies().len(), 0);
    assert_eq!(f.vault.impaired_strategies().len(), 0);
    assert_eq!(f.asset.balance(&strategy), 90 * UNIT);
    assert_eq!(f.vault.total_assets(), 10 * UNIT);
}

// -------------------------------------------------------------------------
// Authorization
// -------------------------------------------------------------------------

#[test]
fn admin_functions_require_admin_auth() {
    let f = Fixture::new();
    f.vault.set_paused(&true);
    let auths = f.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, f.admin);

    // Without mocked auths nobody but the admin can pause.
    f.env.set_auths(&[]);
    assert!(f.vault.try_set_paused(&false).is_err());
}

#[test]
fn deposit_requires_depositor_auth() {
    let f = Fixture::new();
    let user = f.user(10 * UNIT);
    f.vault.deposit(&user, &(10 * UNIT), &0);
    assert_eq!(f.env.auths()[0].0, user);
}

#[test]
fn admin_handover_is_two_step() {
    let f = Fixture::new();
    let next = Address::generate(&f.env);
    assert_eq!(f.vault.try_accept_admin(), Err(Ok(VaultError::NoPendingAdmin)));
    f.vault.propose_admin(&next);
    assert_eq!(f.vault.admin(), f.admin);
    f.vault.accept_admin();
    assert_eq!(f.vault.admin(), next);
}

#[test]
fn config_changes_are_bounded() {
    let f = Fixture::new();
    assert_eq!(
        f.vault.try_update_config(&2_001, &BUFFER_BPS, &f.fee_recipient),
        Err(Ok(VaultError::InvalidConfig))
    );
    let strategy = f.add_strategy(9_500);
    assert_eq!(
        f.vault.try_update_config(&FEE_BPS, &600, &f.fee_recipient),
        Err(Ok(VaultError::AllocationExceedsTotal))
    );
    f.vault.set_allocation(&strategy, &9_000);
    f.vault.update_config(&500, &1_000, &f.fee_recipient);
    assert_eq!(f.vault.fee_bps(), 500);
}
