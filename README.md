# Nema — USDT0 yield vault on Stellar

Deposit USDT0, receive **nUSDT0**, earn yield from XOXNO lending. Non-custodial: the team never holds funds, and withdrawals can never be paused.

HackMeridian 2026 · Lisbon. Product decisions live in `NEMA_BRIEF.md`; the build plan is in `PLAN.md`.

```
            Freighter / Lobstr / xBull (Stellar Wallets Kit)
                    │ deposit USDT0        ▲ nUSDT0 (classic asset, SAC admin = vault)
                    ▼                      │
 SEP-40 oracle ──► NemaVault (Soroban) ────┘        Keeper (permissionless)
   peg guard        shares · fees · caps · timelock ◄── harvest / rebalance / TTL
                    │ one strategy per tx
                    ▼
            XoxnoStrategy ──► XOXNO controller (mainnet)
                          └─► MockLending  (testnet, same interface)
```

## Repository

| Path | What |
|---|---|
| `contracts/vault` | The vault: deposit/withdraw, share math, performance fee, caps, timelocked strategies, pause, peg guard |
| `contracts/strategy-xoxno` | XOXNO adapter (owns one XOXNO account, pre-authorizes the pool pull) |
| `contracts/mock-lending` | XOXNO-compatible controller for testnet (interest from a funded reserve) |
| `contracts/mock-oracle` | SEP-40 feed for testnet (lets you simulate a depeg) |
| `contracts/interfaces` | Shared `Strategy`, XOXNO controller and SEP-40 client traits |
| `contracts/integration-tests` | Vault + adapter + mock lending, with real wallet auth trees |
| `backend` | Hono API (mainnet stats, yields, vault state, faucet), keeper, event indexer |
| `frontend` | Next.js 16 app: landing, `/app` vault, `/transparency` |
| `scripts/deploy-testnet.sh` | Full testnet deployment; writes `deployments/testnet.json` |

## Run it

Prerequisites: Rust with the `wasm32v1-none` target, Stellar CLI ≥ 27, Node ≥ 20.

```bash
# 1. Contracts: test and build
cd contracts && cargo test && stellar contract build

# 2. Deploy everything to testnet (fresh issuers each run, ~1 min)
./scripts/deploy-testnet.sh

# 3. API + keeper + indexer  (http://localhost:8787)
cd backend && npm install && npm run dev

# 4. Web app  (http://localhost:3000)
cd frontend && npm install && npm run dev

# Optional: scripted user journey against testnet (needs the API running)
cd backend && npm run e2e
```

The deploy script writes `backend/.env` with only two keys: the keeper (permissionless calls, mock oracle) and the mock USDT0 issuer (faucet). The admin key never leaves the Stellar CLI keystore.

## Security model

- **Funds only move to vetted places.** No admin function transfers assets. Strategies are bound to this vault and asset, and only become active after a timelock; caps can only be lowered.
- **Withdrawals are always open.** `withdraw` ignores pause and the peg guard; it unwinds strategies on demand.
- **Share math favors the vault.** Every conversion rounds down. A virtual offset plus 1,000 shares locked on the first deposit defeat the first-depositor inflation attack (see `inflation_attack_is_unprofitable`).
- **Fair fees.** 10% of profit above a high-water mark, accrued before every deposit and withdrawal so newcomers never pay for earlier gains. Hard cap of 20%.
- **No hidden minting.** nUSDT0's SAC admin is the vault and the issuer's master key is set to weight 0 at deployment.
- **Immutable.** No upgrade entry point on the vault or the strategy.
- **Soroban specifics.** Rebalancing touches one strategy per transaction (resource limits); every call extends instance TTL.

30 tests cover the above: `cd contracts && cargo test`.

## Honest notes for the demo

- USDT0 is mainnet-only, so testnet uses **mock USDT0**. XOXNO's testnet addresses were not available, so **MockLending** implements the same controller interface and the real `strategy-xoxno` adapter runs unchanged. Its rate mirrors XOXNO's live mainnet USDT0 rate (0.76%).
- The landing page's numbers (trustlines, funded accounts, yields) are **live mainnet data**.
- Realistic vault APY today is ~0.4–0.8%. Aquarius LP is the next strategy, shown as "next".
- Contracts are unaudited.

## Mainnet reference addresses

See `NEMA_BRIEF.md` §4 (USDT0 SAC, XOXNO controller, Aquarius pool), verified on StellarExpert.
