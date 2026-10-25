#![no_std]
//! # Mock SEP-40 oracle (testnet only)
//!
//! Admin-set prices behind the SEP-40 `decimals` / `lastprice` interface, so
//! the vault's peg guard can be demonstrated (including a simulated depeg)
//! until RedStone's USDT0 feed is available on testnet.

use nema_interfaces::sep40::{Asset, PriceData, PriceFeed};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP: u32 = 60 * DAY_IN_LEDGERS;
const THRESHOLD: u32 = BUMP - DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Decimals,
    Price(Asset),
}

#[contract]
pub struct MockOracle;

#[contractimpl]
impl MockOracle {
    pub fn __constructor(env: Env, admin: Address, decimals: u32) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().extend_ttl(THRESHOLD, BUMP);
    }

    /// Records `price` for `asset` at the current ledger time.
    pub fn set_price(env: Env, asset: Asset, price: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let data = PriceData {
            price,
            timestamp: env.ledger().timestamp(),
        };
        let key = DataKey::Price(asset);
        env.storage().persistent().set(&key, &data);
        env.storage().persistent().extend_ttl(&key, THRESHOLD, BUMP);
        env.storage().instance().extend_ttl(THRESHOLD, BUMP);
    }
}

#[contractimpl]
impl PriceFeed for MockOracle {
    fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap()
    }

    fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        env.storage().persistent().get(&DataKey::Price(asset))
    }
}
