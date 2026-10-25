use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    InvalidConfig = 1,
    AmountNotPositive = 2,
    ArithmeticOverflow = 3,
    Paused = 4,
    GuardTripped = 5,
    SlippageExceeded = 6,
    ZeroShares = 7,
    FirstDepositTooSmall = 8,
    InsufficientShares = 9,
    InsufficientLiquidity = 10,
    StrategyNotFound = 11,
    StrategyExists = 12,
    StrategyMismatch = 13,
    TooManyStrategies = 14,
    TimelockNotElapsed = 15,
    NoPendingStrategy = 16,
    AllocationExceedsCap = 17,
    AllocationExceedsTotal = 18,
    CapIncreaseNotAllowed = 19,
    StrategyNotEmpty = 20,
    NoPendingAdmin = 21,
    NothingToClaim = 22,
}
