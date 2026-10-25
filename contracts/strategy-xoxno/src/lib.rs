#![no_std]
//! # Nema XOXNO strategy
//!
//! Supplies the vault's asset to the XOXNO lending controller and reports
//! the resulting collateral as its balance. Interest accrues inside XOXNO, so
//! there is nothing to harvest.
//!
//! The adapter owns a single XOXNO account (a position NFT) on behalf of its
//! vault. Only the vault can move funds; there is no admin and no upgrade
//! path. The same code runs against `nema-mock-lending` on testnet, which
//! implements the identical controller interface.

use nema_interfaces::{
    strategy::Strategy,
    xoxno::{ControllerClient, HubAssetKey},
};
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, Env, IntoVal, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP: u32 = 60 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum StrategyError {
    AmountNotPositive = 1,
    NoPosition = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub vault: Address,
    pub asset: Address,
    pub controller: Address,
    pub pool: Address,
    pub hub_id: u32,
    pub spoke_id: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    AccountId,
}

#[contract]
pub struct XoxnoStrategy;

#[contractimpl]
impl XoxnoStrategy {
    pub fn __constructor(env: Env, vault: Address, asset: Address, controller: Address, hub_id: u32, spoke_id: u32) {
        let pool = ControllerClient::new(&env, &controller).get_pool_address();
        let config = Config {
            vault,
            asset,
            controller,
            pool,
            hub_id,
            spoke_id,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        extend_instance(&env);
    }

    pub fn config(env: Env) -> Config {
        config(&env)
    }

    /// XOXNO account id holding the position, 0 when none is open.
    pub fn account_id(env: Env) -> u64 {
        account_id(&env)
    }
}

#[contractimpl]
impl Strategy for XoxnoStrategy {
    fn asset(env: Env) -> Address {
        config(&env).asset
    }

    fn vault(env: Env) -> Address {
        config(&env).vault
    }

    fn balance(env: Env) -> i128 {
        let cfg = config(&env);
        match account_id(&env) {
            0 => 0,
            id => controller(&env, &cfg).get_collateral_amount(&id, &hub_asset(&cfg)),
        }
    }

    fn deposit(env: Env, amount: i128) {
        let cfg = config(&env);
        cfg.vault.require_auth();
        extend_instance(&env);
        if amount <= 0 {
            panic_with_error!(&env, StrategyError::AmountNotPositive);
        }

        let me = env.current_contract_address();
        // The pool, not the controller, pulls the tokens: pre-authorize
        // exactly one transfer of exactly this amount.
        env.authorize_as_current_contract(vec![
            &env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: cfg.asset.clone(),
                    fn_name: symbol_short!("transfer"),
                    args: (me.clone(), cfg.pool.clone(), amount).into_val(&env),
                },
                sub_invocations: Vec::new(&env),
            }),
        ]);

        let id = controller(&env, &cfg).supply(
            &me,
            &account_id(&env),
            &cfg.spoke_id,
            &vec![&env, (hub_asset(&cfg), amount)],
        );
        env.storage().instance().set(&DataKey::AccountId, &id);
    }

    fn withdraw(env: Env, amount: i128, to: Address) -> i128 {
        let cfg = config(&env);
        cfg.vault.require_auth();
        extend_instance(&env);
        if amount <= 0 {
            panic_with_error!(&env, StrategyError::AmountNotPositive);
        }
        let id = account_id(&env);
        if id == 0 {
            panic_with_error!(&env, StrategyError::NoPosition);
        }

        let key = hub_asset(&cfg);
        let client = controller(&env, &cfg);
        let full = amount >= client.get_collateral_amount(&id, &key);
        // XOXNO treats zero as "withdraw everything", which avoids dust.
        let request = if full { 0 } else { amount };

        let paid = client
            .withdraw(&env.current_contract_address(), &id, &vec![&env, (key.clone(), request)], &Some(to))
            .iter()
            .filter(|(k, _)| *k == key)
            .map(|(_, v)| v)
            .sum();

        if full {
            env.storage().instance().remove(&DataKey::AccountId);
        }
        paid
    }
}

fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

fn config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn account_id(env: &Env) -> u64 {
    env.storage().instance().get(&DataKey::AccountId).unwrap_or(0)
}

fn controller<'a>(env: &'a Env, cfg: &Config) -> ControllerClient<'a> {
    ControllerClient::new(env, &cfg.controller)
}

fn hub_asset(cfg: &Config) -> HubAssetKey {
    HubAssetKey {
        hub_id: cfg.hub_id,
        asset: cfg.asset.clone(),
    }
}
