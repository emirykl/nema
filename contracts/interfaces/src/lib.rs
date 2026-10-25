#![no_std]
//! Cross-contract interfaces shared by the Nema contracts.
//!
//! - [`strategy`]: what the vault expects from every yield strategy.
//! - [`xoxno`]: the subset of the XOXNO lending controller that Nema calls.
//! - [`sep40`]: the SEP-40 price feed subset read by the vault's peg guard.

pub mod sep40;
pub mod strategy;
pub mod xoxno;
