//! Typed access to vault state. Everything lives in instance storage: the
//! state is small and bounded (at most `MAX_STRATEGIES` entries), and user
//! balances live in the share token, not here.

use nema_interfaces::sep40;
use soroban_sdk::{contracttype, Address, Env, Vec};

const DAY_IN_LEDGERS: u32 = 17_280;
pub const INSTANCE_BUMP: u32 = 60 * DAY_IN_LEDGERS;
pub const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    PendingAdmin,
    Asset,
    ShareToken,
    FeeRecipient,
    FeeBps,
    BufferBps,
    Timelock,
    Paused,
    TotalShares,
    HighWater,
    FeeShares,
    Strategies,
    Pending(Address),
    Guard,
    Impaired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyInfo {
    pub address: Address,
    /// Hard ceiling on the share of total assets this strategy may hold.
    pub cap_bps: u32,
    /// Allocation the permissionless `rebalance` steers towards.
    pub target_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingStrategy {
    pub cap_bps: u32,
    pub eta: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GuardConfig {
    pub oracle: Address,
    pub asset: sep40::Asset,
    /// Maximum allowed distance from $1, in basis points.
    pub max_depeg_bps: u32,
    /// Maximum allowed price age, in seconds.
    pub max_age: u64,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GuardStatus {
    Disabled,
    Healthy,
    Depegged,
    Stale,
}

pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

macro_rules! value {
    ($get:ident, $set:ident, $key:expr, $ty:ty) => {
        pub fn $get(env: &Env) -> $ty {
            env.storage().instance().get(&$key).unwrap()
        }
        pub fn $set(env: &Env, value: &$ty) {
            env.storage().instance().set(&$key, value);
        }
    };
    ($get:ident, $set:ident, $key:expr, $ty:ty, $default:expr) => {
        pub fn $get(env: &Env) -> $ty {
            env.storage().instance().get(&$key).unwrap_or($default)
        }
        pub fn $set(env: &Env, value: &$ty) {
            env.storage().instance().set(&$key, value);
        }
    };
}

value!(admin, set_admin, DataKey::Admin, Address);
value!(asset, set_asset, DataKey::Asset, Address);
value!(share_token, set_share_token, DataKey::ShareToken, Address);
value!(fee_recipient, set_fee_recipient, DataKey::FeeRecipient, Address);
value!(fee_bps, set_fee_bps, DataKey::FeeBps, u32);
value!(buffer_bps, set_buffer_bps, DataKey::BufferBps, u32);
value!(timelock, set_timelock, DataKey::Timelock, u64);
value!(paused, set_paused, DataKey::Paused, bool, false);
value!(total_shares, set_total_shares, DataKey::TotalShares, i128, 0);
value!(high_water, set_high_water, DataKey::HighWater, i128, 0);
value!(fee_shares, set_fee_shares, DataKey::FeeShares, i128, 0);

pub fn pending_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::PendingAdmin)
}

pub fn set_pending_admin(env: &Env, value: Option<&Address>) {
    match value {
        Some(addr) => env.storage().instance().set(&DataKey::PendingAdmin, addr),
        None => env.storage().instance().remove(&DataKey::PendingAdmin),
    }
}

pub fn strategies(env: &Env) -> Vec<StrategyInfo> {
    env.storage()
        .instance()
        .get(&DataKey::Strategies)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn set_strategies(env: &Env, value: &Vec<StrategyInfo>) {
    env.storage().instance().set(&DataKey::Strategies, value);
}

pub fn pending_strategy(env: &Env, strategy: &Address) -> Option<PendingStrategy> {
    env.storage()
        .instance()
        .get(&DataKey::Pending(strategy.clone()))
}

pub fn set_pending_strategy(env: &Env, strategy: &Address, value: Option<&PendingStrategy>) {
    let key = DataKey::Pending(strategy.clone());
    match value {
        Some(p) => env.storage().instance().set(&key, p),
        None => env.storage().instance().remove(&key),
    }
}

pub fn guard(env: &Env) -> Option<GuardConfig> {
    env.storage().instance().get(&DataKey::Guard)
}

pub fn set_guard(env: &Env, value: Option<&GuardConfig>) {
    match value {
        Some(g) => env.storage().instance().set(&DataKey::Guard, g),
        None => env.storage().instance().remove(&DataKey::Guard),
    }
}

/// Strategies that stopped answering. They are valued at zero and skipped
/// until someone shows they answer again (see `NemaVault::report_unavailable`).
pub fn impaired(env: &Env) -> Vec<Address> {
    env.storage()
        .instance()
        .get(&DataKey::Impaired)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn set_impaired(env: &Env, value: &Vec<Address>) {
    env.storage().instance().set(&DataKey::Impaired, value);
}

pub fn is_impaired(env: &Env, strategy: &Address) -> bool {
    impaired(env).contains(strategy)
}
