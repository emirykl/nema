//! Peg guard: reads a SEP-40 feed and reports whether the asset still trades
//! close enough to $1. A tripped guard blocks new deposits and makes
//! `rebalance` pull funds back from strategies. Withdrawals are never gated.

use nema_interfaces::sep40::PriceFeedClient;
use soroban_sdk::Env;

use crate::math::BPS;
use crate::storage::{self, GuardStatus};

/// Oracles with more decimals than this are treated as misconfigured.
const MAX_ORACLE_DECIMALS: u32 = 18;

pub fn status(env: &Env) -> GuardStatus {
    let Some(cfg) = storage::guard(env) else {
        return GuardStatus::Disabled;
    };
    let feed = PriceFeedClient::new(env, &cfg.oracle);

    let decimals = feed.decimals();
    if decimals > MAX_ORACLE_DECIMALS {
        return GuardStatus::Stale;
    }
    let Some(price) = feed.lastprice(&cfg.asset) else {
        return GuardStatus::Stale;
    };

    let now = env.ledger().timestamp();
    if price.timestamp > now || now - price.timestamp > cfg.max_age {
        return GuardStatus::Stale;
    }

    let peg = 10i128.pow(decimals);
    let deviation = (price.price - peg).abs();
    // deviation / peg > max_depeg_bps / BPS, kept in integers.
    if deviation.saturating_mul(BPS) > peg.saturating_mul(cfg.max_depeg_bps as i128) {
        return GuardStatus::Depegged;
    }
    GuardStatus::Healthy
}

pub fn is_tripped(env: &Env) -> bool {
    matches!(status(env), GuardStatus::Depegged | GuardStatus::Stale)
}
