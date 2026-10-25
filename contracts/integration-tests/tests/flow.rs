//! Vault + XOXNO strategy + mock lending, wired as on testnet.
//!
//! User calls use explicit auth trees (what a wallet signs) instead of
//! `mock_all_auths`, and keeper calls run with no auths at all, so the
//! contract-to-contract authorization path is exercised for real.

use nema_interfaces::xoxno::HubAssetKey;
use nema_mock_lending::{MockLending, MockLendingClient};
use nema_strategy_xoxno::{XoxnoStrategy, XoxnoStrategyClient};
use nema_vault::{NemaVault, NemaVaultClient, LOCKED_SHARES, ONE_SHARE};
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, IntoVal,
};

const UNIT: i128 = ONE_SHARE;
const YEAR: u64 = 31_536_000;
const HUB_ID: u32 = 1;
const SPOKE_ID: u32 = 1;
const XOXNO_APR_BPS: u32 = 76; // 0.76%, measured on mainnet

struct World {
    env: Env,
    vault: NemaVaultClient<'static>,
    strategy: XoxnoStrategyClient<'static>,
    lending: MockLendingClient<'static>,
    asset: TokenClient<'static>,
    asset_admin: StellarAssetClient<'static>,
    shares: TokenClient<'static>,
}

impl World {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|l| l.timestamp = 1_000_000);

        let admin = Address::generate(&env);
        let asset_sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let share_sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let asset = asset_sac.address();
        let asset_admin = StellarAssetClient::new(&env, &asset);

        let lending_id = env.register(MockLending, (admin.clone(), HUB_ID, asset.clone(), XOXNO_APR_BPS));
        // Reserve that pays the mock interest.
        asset_admin.mint(&lending_id, &(1_000_000 * UNIT));

        let vault_id = env.register(
            NemaVault,
            (admin.clone(), asset.clone(), share_sac.address(), admin.clone(), 1_000u32, 500u32, 0u64),
        );
        StellarAssetClient::new(&env, &share_sac.address()).set_admin(&vault_id);

        let strategy_id = env.register(
            XoxnoStrategy,
            (vault_id.clone(), asset.clone(), lending_id.clone(), HUB_ID, SPOKE_ID),
        );

        let vault = NemaVaultClient::new(&env, &vault_id);
        vault.propose_strategy(&strategy_id, &10_000);
        vault.activate_strategy(&strategy_id);
        vault.set_allocation(&strategy_id, &9_500);

        World {
            vault,
            strategy: XoxnoStrategyClient::new(&env, &strategy_id),
            lending: MockLendingClient::new(&env, &lending_id),
            asset: TokenClient::new(&env, &asset),
            asset_admin,
            shares: TokenClient::new(&env, &share_sac.address()),
            env,
        }
    }

    fn user(&self, balance: i128) -> Address {
        let user = Address::generate(&self.env);
        self.asset_admin.mint(&user, &balance);
        user
    }

    /// Exactly what the user's wallet signs for a deposit.
    fn deposit(&self, user: &Address, assets: i128) -> i128 {
        self.env.mock_auths(&[MockAuth {
            address: user,
            invoke: &MockAuthInvoke {
                contract: &self.vault.address,
                fn_name: "deposit",
                args: (user.clone(), assets, 0i128).into_val(&self.env),
                sub_invokes: &[MockAuthInvoke {
                    contract: &self.asset.address,
                    fn_name: "transfer",
                    args: (user.clone(), self.vault.address.clone(), assets).into_val(&self.env),
                    sub_invokes: &[],
                }],
            },
        }]);
        self.vault.deposit(user, &assets, &0)
    }

    /// Exactly what the user's wallet signs for a withdrawal.
    fn withdraw(&self, user: &Address, shares: i128) -> i128 {
        self.env.mock_auths(&[MockAuth {
            address: user,
            invoke: &MockAuthInvoke {
                contract: &self.vault.address,
                fn_name: "withdraw",
                args: (user.clone(), shares, 0i128).into_val(&self.env),
                sub_invokes: &[MockAuthInvoke {
                    contract: &self.shares.address,
                    fn_name: "burn",
                    args: (user.clone(), shares).into_val(&self.env),
                    sub_invokes: &[],
                }],
            },
        }]);
        self.vault.withdraw(user, &shares, &0)
    }

    /// Permissionless keeper call with no signatures at all.
    fn rebalance(&self) -> i128 {
        self.env.set_auths(&[]);
        self.vault.rebalance(&self.strategy.address)
    }

    fn advance(&self, seconds: u64) {
        self.env.ledger().with_mut(|l| l.timestamp += seconds);
    }
}

#[test]
fn deposit_earn_withdraw_through_xoxno() {
    let w = World::new();
    let user = w.user(1_000 * UNIT);

    let shares = w.deposit(&user, 1_000 * UNIT);
    assert_eq!(shares, 1_000 * UNIT - LOCKED_SHARES);

    assert_eq!(w.rebalance(), 950 * UNIT);
    assert_eq!(w.strategy.balance(), 950 * UNIT);
    assert_eq!(w.vault.idle_assets(), 50 * UNIT);
    assert!(w.strategy.account_id() > 0);

    w.advance(YEAR);
    // 950 * 0.76% = 7.22 USDT0 of interest.
    let earned = w.strategy.balance() - 950 * UNIT;
    assert!((earned - 72_200_000).abs() <= 1, "earned {earned}");

    w.env.set_auths(&[]);
    let fee_shares = w.vault.harvest();
    assert!(fee_shares > 0);
    // Holders keep 90% of the profit.
    let price = w.vault.share_price();
    assert!(price > UNIT + 64_000 && price < UNIT + 65_500, "price {price}");

    // Withdrawal must reach into XOXNO for everything beyond the buffer.
    let out = w.withdraw(&user, shares);
    assert!(out > 1_006 * UNIT, "out {out}");
    assert_eq!(w.asset.balance(&user), out);
    assert_eq!(w.shares.balance(&user), 0);
}

#[test]
fn full_unwind_closes_the_xoxno_account_and_reopens_on_next_supply() {
    let w = World::new();
    let user = w.user(100 * UNIT);
    w.deposit(&user, 100 * UNIT);
    w.rebalance();
    let first_account = w.strategy.account_id();

    w.env.mock_all_auths();
    w.vault.set_allocation(&w.strategy.address, &0);
    assert_eq!(w.rebalance(), -95 * UNIT);
    assert_eq!(w.strategy.account_id(), 0);
    assert_eq!(w.strategy.balance(), 0);

    w.env.mock_all_auths();
    w.vault.set_allocation(&w.strategy.address, &9_000);
    w.rebalance();
    assert!(w.strategy.account_id() > first_account);
}

#[test]
fn only_the_vault_can_move_strategy_funds() {
    let w = World::new();
    let user = w.user(100 * UNIT);
    w.deposit(&user, 100 * UNIT);
    w.rebalance();

    let thief = Address::generate(&w.env);
    // The thief signs everything they can; the strategy still demands the vault.
    w.env.mock_auths(&[MockAuth {
        address: &thief,
        invoke: &MockAuthInvoke {
            contract: &w.strategy.address,
            fn_name: "withdraw",
            args: (UNIT, thief.clone()).into_val(&w.env),
            sub_invokes: &[],
        },
    }]);
    assert!(w.strategy.try_withdraw(&UNIT, &thief).is_err());
    assert_eq!(w.asset.balance(&thief), 0);
}

#[test]
fn lending_positions_are_owner_only() {
    let w = World::new();
    let user = w.user(100 * UNIT);
    w.deposit(&user, 100 * UNIT);
    w.rebalance();

    let thief = Address::generate(&w.env);
    w.env.mock_all_auths();
    let key = HubAssetKey {
        hub_id: HUB_ID,
        asset: w.asset.address.clone(),
    };
    let result = w.lending.try_withdraw(
        &thief,
        &w.strategy.account_id(),
        &vec![&w.env, (key, 0i128)],
        &Some(thief.clone()),
    );
    assert!(result.is_err());
}

#[test]
fn many_users_share_yield_pro_rata() {
    let w = World::new();
    let alice = w.user(1_000 * UNIT);
    let bob = w.user(3_000 * UNIT);
    let a = w.deposit(&alice, 1_000 * UNIT);
    let b = w.deposit(&bob, 3_000 * UNIT);
    w.rebalance();
    w.advance(YEAR / 2);

    let alice_out = w.withdraw(&alice, a);
    let bob_out = w.withdraw(&bob, b);
    let alice_gain = alice_out - 1_000 * UNIT;
    let bob_gain = bob_out - 3_000 * UNIT;
    assert!(alice_gain > 0);
    // Bob put in 3x as much. Alice, the first depositor, funded the locked
    // shares (plus the few stroops of yield they earn) and nothing more.
    assert!((bob_gain - 3 * alice_gain).abs() <= 3 * (LOCKED_SHARES + 10), "{alice_gain} vs {bob_gain}");
}
