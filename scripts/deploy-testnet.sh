#!/usr/bin/env bash
# Deploys the full Nema stack to Stellar testnet and writes the addresses to
# deployments/testnet.json (read by the backend and frontend).
#
#   - mock USDT0     classic asset + SAC; USDT0 does not exist on testnet
#   - nUSDT0         classic asset + SAC; SAC admin handed to the vault,
#                    issuer master key then disabled so nothing else can mint
#   - mock lending   XOXNO-compatible controller (until XOXNO testnet is known)
#   - mock oracle    SEP-40 feed (until RedStone's testnet feed is known)
#   - vault          + XOXNO strategy, activated after the strategy timelock
#
# Every run creates fresh issuers, so it can be re-run for a clean deployment.
#
# Usage: scripts/deploy-testnet.sh
# The backend only receives the keeper key (permissionless vault calls and the
# mock oracle) and the mock USDT0 issuer key (faucet). The admin key stays here.
#
# Env:   MOCK_APR_BPS (default 76 = 0.76%, XOXNO's measured mainnet rate)
#        STRATEGY_TIMELOCK (default 30 seconds; mainnet should use days)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK=testnet
MOCK_APR_BPS="${MOCK_APR_BPS:-76}"
STRATEGY_TIMELOCK="${STRATEGY_TIMELOCK:-30}"
FEE_BPS=1000       # 10% of profit
BUFFER_BPS=500     # 5% kept idle for instant withdrawals
TARGET_BPS=9500    # rest goes to XOXNO
HUB_ID=1
SPOKE_ID=1
RUN_ID="$(date +%s)"
WASM_DIR="$ROOT/contracts/target/wasm32v1-none/release"
UNIT=10000000      # 1 token = 10^7 stroops

log() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }

key() {
  local name="$1"
  if ! stellar keys address "$name" >/dev/null 2>&1; then
    stellar keys generate "$name" --network "$NETWORK" --fund >/dev/null
  else
    stellar keys fund "$name" --network "$NETWORK" >/dev/null 2>&1 || true
  fi
  stellar keys address "$name"
}

invoke() {
  local id="$1" source="$2"
  shift 2
  stellar contract invoke --id "$id" --source-account "$source" --network "$NETWORK" -- "$@"
}

log "Building contracts"
(cd "$ROOT/contracts" && stellar contract build >/dev/null)

log "Preparing accounts"
ADMIN_ADDR=$(key nema-admin)
KEEPER_ADDR=$(key nema-keeper)
USDT0_ISSUER=$(key "nema-usdt0-issuer-$RUN_ID")
NUSDT0_ISSUER=$(key "nema-nusdt0-issuer-$RUN_ID")
echo "admin  $ADMIN_ADDR"
echo "keeper $KEEPER_ADDR"

USDT0_ASSET="USDT0:$USDT0_ISSUER"
NUSDT0_ASSET="nUSDT0:$NUSDT0_ISSUER"

log "Deploying asset contracts (mock USDT0, nUSDT0)"
USDT0_SAC=$(stellar contract asset deploy --asset "$USDT0_ASSET" --source-account "nema-usdt0-issuer-$RUN_ID" --network "$NETWORK")
NUSDT0_SAC=$(stellar contract asset deploy --asset "$NUSDT0_ASSET" --source-account "nema-nusdt0-issuer-$RUN_ID" --network "$NETWORK")
echo "USDT0  $USDT0_SAC"
echo "nUSDT0 $NUSDT0_SAC"

log "Deploying mock lending (XOXNO-compatible, ${MOCK_APR_BPS} bps APR)"
LENDING=$(stellar contract deploy --wasm "$WASM_DIR/nema_mock_lending.wasm" --source-account nema-admin --network "$NETWORK" \
  -- --admin "$ADMIN_ADDR" --hub_id "$HUB_ID" --asset "$USDT0_SAC" --rate_bps "$MOCK_APR_BPS")
echo "lending $LENDING"
# Interest reserve: the mock has no borrowers, so the reserve pays the yield.
invoke "$USDT0_SAC" "nema-usdt0-issuer-$RUN_ID" mint --to "$LENDING" --amount $((1000000 * UNIT)) >/dev/null

log "Deploying mock SEP-40 oracle"
ORACLE=$(stellar contract deploy --wasm "$WASM_DIR/nema_mock_oracle.wasm" --source-account nema-admin --network "$NETWORK" \
  -- --admin "$KEEPER_ADDR" --decimals 8)
invoke "$ORACLE" nema-keeper set_price --asset '{"Other":"USDT0"}' --price 100000000 >/dev/null
echo "oracle $ORACLE"

log "Deploying vault"
VAULT=$(stellar contract deploy --wasm "$WASM_DIR/nema_vault.wasm" --source-account nema-admin --network "$NETWORK" \
  -- --admin "$ADMIN_ADDR" --asset "$USDT0_SAC" --share_token "$NUSDT0_SAC" --fee_recipient "$ADMIN_ADDR" \
     --fee_bps "$FEE_BPS" --buffer_bps "$BUFFER_BPS" --strategy_timelock "$STRATEGY_TIMELOCK")
echo "vault $VAULT"

log "Handing nUSDT0 minting to the vault and locking the issuer"
invoke "$NUSDT0_SAC" "nema-nusdt0-issuer-$RUN_ID" set_admin --new_admin "$VAULT" >/dev/null
stellar tx new set-options --source-account "nema-nusdt0-issuer-$RUN_ID" --master-weight 0 --network "$NETWORK" >/dev/null
echo "nUSDT0 admin = vault, issuer master weight = 0"

log "Deploying XOXNO strategy"
STRATEGY=$(stellar contract deploy --wasm "$WASM_DIR/nema_strategy_xoxno.wasm" --source-account nema-admin --network "$NETWORK" \
  -- --vault "$VAULT" --asset "$USDT0_SAC" --controller "$LENDING" --hub_id "$HUB_ID" --spoke_id "$SPOKE_ID")
echo "strategy $STRATEGY"

log "Proposing strategy (timelock ${STRATEGY_TIMELOCK}s)"
invoke "$VAULT" nema-admin propose_strategy --strategy "$STRATEGY" --cap_bps 10000 >/dev/null
sleep $((STRATEGY_TIMELOCK + 6))
invoke "$VAULT" nema-admin activate_strategy --strategy "$STRATEGY" >/dev/null
invoke "$VAULT" nema-admin set_allocation --strategy "$STRATEGY" --target_bps "$TARGET_BPS" >/dev/null

log "Enabling peg guard (1% band, 1 day max age)"
invoke "$VAULT" nema-admin set_guard --config \
  "{\"oracle\":\"$ORACLE\",\"asset\":{\"Other\":\"USDT0\"},\"max_depeg_bps\":100,\"max_age\":86400}" >/dev/null

log "Seeding the vault (first deposit locks the dead shares)"
stellar tx new change-trust --source-account nema-admin --line "$USDT0_ASSET" --network "$NETWORK" >/dev/null
stellar tx new change-trust --source-account nema-admin --line "$NUSDT0_ASSET" --network "$NETWORK" >/dev/null
stellar tx new payment --source-account "nema-usdt0-issuer-$RUN_ID" --destination "$ADMIN_ADDR" \
  --asset "$USDT0_ASSET" --amount $((10000 * UNIT)) --network "$NETWORK" >/dev/null
invoke "$VAULT" nema-admin deposit --from "$ADMIN_ADDR" --assets $((100 * UNIT)) --min_shares 0 >/dev/null
invoke "$VAULT" nema-keeper rebalance --strategy "$STRATEGY" >/dev/null
echo "seeded 100 USDT0, total assets: $(invoke "$VAULT" nema-keeper total_assets 2>/dev/null)"

log "Writing deployments/testnet.json, frontend config and backend/.env"
mkdir -p "$ROOT/deployments"
cat > "$ROOT/deployments/testnet.json" <<EOF
{
  "network": "testnet",
  "rpcUrl": "https://soroban-testnet.stellar.org",
  "horizonUrl": "https://horizon-testnet.stellar.org",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "admin": "$ADMIN_ADDR",
  "assets": {
    "usdt0": { "code": "USDT0", "issuer": "$USDT0_ISSUER", "contract": "$USDT0_SAC", "mock": true },
    "nusdt0": { "code": "nUSDT0", "issuer": "$NUSDT0_ISSUER", "contract": "$NUSDT0_SAC" }
  },
  "contracts": {
    "vault": "$VAULT",
    "strategyXoxno": "$STRATEGY",
    "lending": "$LENDING",
    "oracle": "$ORACLE"
  },
  "lending": { "mock": true, "hubId": $HUB_ID, "spokeId": $SPOKE_ID, "aprBps": $MOCK_APR_BPS },
  "vault": { "feeBps": $FEE_BPS, "bufferBps": $BUFFER_BPS, "targetBps": $TARGET_BPS }
}
EOF

mkdir -p "$ROOT/frontend/src/config"
cp "$ROOT/deployments/testnet.json" "$ROOT/frontend/src/config/deployment.json"

ENV_FILE="$ROOT/backend/.env"
touch "$ENV_FILE"
set_env() {
  local k="$1" v="$2"
  grep -v "^$k=" "$ENV_FILE" > "$ENV_FILE.tmp" || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  echo "$k=$v" >> "$ENV_FILE"
}
set_env KEEPER_SECRET "$(stellar keys show nema-keeper)"
set_env FAUCET_ISSUER_SECRET "$(stellar keys show "nema-usdt0-issuer-$RUN_ID")"

log "Done"
cat "$ROOT/deployments/testnet.json"
