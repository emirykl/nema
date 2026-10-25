use soroban_sdk::{contractevent, Address};

#[contractevent(topics = ["deposit"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Deposited {
    #[topic]
    pub from: Address,
    pub assets: i128,
    pub shares: i128,
}

#[contractevent(topics = ["withdraw"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Withdrawn {
    #[topic]
    pub from: Address,
    pub assets: i128,
    pub shares: i128,
}

/// Published whenever performance fees are accrued; carries the post-fee
/// state so indexers can chart the share price without extra reads.
#[contractevent(topics = ["harvest"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Harvested {
    pub total_assets: i128,
    pub total_shares: i128,
    pub fee_shares: i128,
}

#[contractevent(topics = ["rebalance"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Rebalanced {
    #[topic]
    pub strategy: Address,
    /// Positive when assets moved into the strategy, negative when pulled out.
    pub delta: i128,
    pub strategy_balance: i128,
}

#[contractevent(topics = ["fees_claimed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeesClaimed {
    #[topic]
    pub recipient: Address,
    pub shares: i128,
}

#[contractevent(topics = ["strategy_proposed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyProposed {
    #[topic]
    pub strategy: Address,
    pub cap_bps: u32,
    pub eta: u64,
}

#[contractevent(topics = ["strategy_added"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyAdded {
    #[topic]
    pub strategy: Address,
    pub cap_bps: u32,
}

#[contractevent(topics = ["strategy_removed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyRemoved {
    #[topic]
    pub strategy: Address,
}

#[contractevent(topics = ["allocation"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AllocationSet {
    #[topic]
    pub strategy: Address,
    pub target_bps: u32,
    pub cap_bps: u32,
}

#[contractevent(topics = ["paused"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PausedSet {
    pub paused: bool,
}

#[contractevent(topics = ["config"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfigChanged {
    pub fee_bps: u32,
    pub buffer_bps: u32,
    pub fee_recipient: Address,
}

#[contractevent(topics = ["admin"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminChanged {
    pub admin: Address,
}

#[contractevent(topics = ["strategy_impaired"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyImpaired {
    #[topic]
    pub strategy: Address,
}

#[contractevent(topics = ["strategy_restored"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyRestored {
    #[topic]
    pub strategy: Address,
}
