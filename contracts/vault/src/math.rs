//! Share accounting. Every conversion rounds down, so the vault never pays a
//! user more than their proportional claim.
//!
//! A virtual offset of one share and one asset (ERC-4626 style) keeps the
//! exchange rate defined on an empty vault and, together with the shares
//! locked on first deposit, makes donation/inflation attacks unprofitable.

use crate::errors::VaultError;

pub const BPS: i128 = 10_000;
pub const VIRTUAL_SHARES: i128 = 1;
pub const VIRTUAL_ASSETS: i128 = 1;

/// `a * b / c`, rounded down, without intermediate overflow panics.
pub fn mul_div_floor(a: i128, b: i128, c: i128) -> Result<i128, VaultError> {
    if c <= 0 {
        return Err(VaultError::ArithmeticOverflow);
    }
    a.checked_mul(b)
        .map(|p| p / c)
        .ok_or(VaultError::ArithmeticOverflow)
}

pub fn assets_to_shares(assets: i128, total_assets: i128, total_shares: i128) -> Result<i128, VaultError> {
    mul_div_floor(assets, total_shares + VIRTUAL_SHARES, total_assets + VIRTUAL_ASSETS)
}

pub fn shares_to_assets(shares: i128, total_assets: i128, total_shares: i128) -> Result<i128, VaultError> {
    mul_div_floor(shares, total_assets + VIRTUAL_ASSETS, total_shares + VIRTUAL_SHARES)
}

pub fn bps_of(amount: i128, bps: u32) -> Result<i128, VaultError> {
    mul_div_floor(amount, bps as i128, BPS)
}

/// Shares to mint so the fee recipient owns `fee_bps` of the profit above
/// the high-water mark, diluting existing holders by exactly that value.
pub fn fee_shares(
    total_assets: i128,
    total_shares: i128,
    high_water: i128,
    fee_bps: u32,
) -> Result<i128, VaultError> {
    if fee_bps == 0 || total_shares == 0 || total_assets <= high_water {
        return Ok(0);
    }
    let fee_assets = bps_of(total_assets - high_water, fee_bps)?;
    if fee_assets == 0 {
        return Ok(0);
    }
    // s / (S + s) = fee / A  =>  s = fee * S / (A - fee)
    mul_div_floor(
        fee_assets,
        total_shares + VIRTUAL_SHARES,
        total_assets - fee_assets + VIRTUAL_ASSETS,
    )
}
