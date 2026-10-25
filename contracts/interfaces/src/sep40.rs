//! SEP-40 price feed subset (implemented by RedStone and Reflector on Stellar).

use soroban_sdk::{contractclient, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

#[contractclient(name = "PriceFeedClient")]
pub trait PriceFeed {
    fn decimals(env: Env) -> u32;

    fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
}
