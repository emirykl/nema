use soroban_sdk::{contractclient, Address, Env};

/// Interface every Nema strategy implements.
///
/// A strategy is bound to exactly one vault and one asset at construction.
/// Only that vault may move funds: `deposit` and `withdraw` must call
/// `vault.require_auth()`. The vault pushes the asset to the strategy with a
/// token transfer before calling `deposit`.
#[contractclient(name = "StrategyClient")]
pub trait Strategy {
    /// Underlying asset managed by the strategy.
    fn asset(env: Env) -> Address;

    /// The only vault allowed to move funds through this strategy.
    fn vault(env: Env) -> Address;

    /// Assets currently attributable to the vault, in asset units.
    fn balance(env: Env) -> i128;

    /// Puts `amount` of the asset, already held by the strategy, to work.
    fn deposit(env: Env, amount: i128);

    /// Withdraws up to `amount` to `to`. Requests above the balance withdraw
    /// everything. Returns the amount actually paid.
    fn withdraw(env: Env, amount: i128, to: Address) -> i128;
}
