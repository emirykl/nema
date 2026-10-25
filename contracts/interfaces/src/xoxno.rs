//! Subset of the XOXNO lending controller (`XOXNO/rs-lending-xlm`,
//! `docs/reference/endpoints.md`) used by the Nema XOXNO strategy.
//! Signatures must match the deployed controller exactly.

use soroban_sdk::{contractclient, contracttype, Address, Env, Vec};

/// A market is a token inside a hub; the same token in two hubs is two markets.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HubAssetKey {
    pub hub_id: u32,
    pub asset: Address,
}

#[contractclient(name = "ControllerClient")]
pub trait Controller {
    /// Supplies measured deposits. `account_id = 0` creates a new account
    /// owned by `caller`. Returns the account id.
    fn supply(
        env: Env,
        caller: Address,
        account_id: u64,
        spoke_id: u32,
        assets: Vec<(HubAssetKey, i128)>,
    ) -> u64;

    /// Withdraws collateral; an amount of zero means the full balance.
    /// Returns the amounts paid.
    fn withdraw(
        env: Env,
        caller: Address,
        account_id: u64,
        withdrawals: Vec<(HubAssetKey, i128)>,
        to: Option<Address>,
    ) -> Vec<(HubAssetKey, i128)>;

    /// Collateral of `account_id` in underlying token units.
    fn get_collateral_amount(env: Env, account_id: u64, hub_asset: HubAssetKey) -> i128;

    fn account_exists(env: Env, account_id: u64) -> bool;

    /// The pool contract that pulls supplied tokens.
    fn get_pool_address(env: Env) -> Address;
}
