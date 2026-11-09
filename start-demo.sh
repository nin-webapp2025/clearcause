#!/usr/bin/env bash
# ClearCause - start the whole demo with one command (macOS / Linux).
#
#   ./start-demo.sh
#
# Starts a local blockchain, deploys the contracts, loads demo campaigns,
# starts the fraud-detection service and serves the website.
# Press Ctrl+C to stop everything.
#
# Options:  --no-seed   --no-ml   --reown-id <id>
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/logs"; mkdir -p "$LOGS"
PIDS=()
NO_SEED=0; NO_ML=0; REOWN_ID=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-seed) NO_SEED=1 ;;
    --no-ml) NO_ML=1 ;;
    --reown-id) REOWN_ID="${2:-}"; shift ;;
    *) echo "unknown option: $1"; exit 2 ;;
  esac
  shift
done

say()  { printf "\n==> %s\n" "$1"; }
note() { printf "    %s\n" "$1"; }

cleanup() {
  printf "\n==> Stopping\n"
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null
  done
  printf "All stopped.\n\n"
}
trap cleanup EXIT INT TERM

wait_port() { # port, description, [seconds]
  local port="$1" what="$2" secs="${3:-90}" i=0
  while [ "$i" -lt $((secs * 2)) ]; do
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then exec 3<&- 3>&-; return 0; fi
    sleep 0.5; i=$((i + 1))
  done
  echo "$what did not start on port $port. See $LOGS." >&2
  return 1
}

set_env() { # file, KEY, VALUE  (replaces the key, keeps the rest of the file)
  local file="$1" key="$2" value="$3"
  touch "$file"
  if grep -q "^[[:space:]]*$key=" "$file"; then
    sed -i.bak "s|^[[:space:]]*$key=.*|$key=$value|" "$file" && rm -f "$file.bak"
  else
    printf "%s=%s\n" "$key" "$value" >> "$file"
  fi
}

# ---------- prerequisites ----------------------------------------------------
say "Checking what is installed"
for cmd in node npm; do
  command -v "$cmd" >/dev/null || { echo "$cmd not found. Install Node.js 18+ first."; exit 1; }
done
note "node $(node -v)"

PYTHON=""
if [ "$NO_ML" -eq 0 ]; then
  for c in python3 python; do command -v "$c" >/dev/null && { PYTHON="$c"; break; }; done
  [ -z "$PYTHON" ] && note "Python not found, so the anomaly model is skipped (the rules still run)."
fi

# ---------- dependencies -----------------------------------------------------
for part in contract client fraud/service; do
  # An empty node_modules folder can survive unzipping, so check for real contents.
  if [ ! -d "$ROOT/$part/node_modules" ] || [ -z "$(ls -A "$ROOT/$part/node_modules" 2>/dev/null)" ]; then
    say "Installing dependencies for $part (first run only)"
    (cd "$ROOT/$part" && npm install --no-audit --no-fund) || exit 1
  fi
done

# Call the tools directly rather than through npx. npx stops to ask "Ok to proceed?" when a
# tool is missing, and with output redirected to a log file nobody can answer it.
HARDHAT="$ROOT/contract/node_modules/.bin/hardhat"
VITE="$ROOT/client/node_modules/.bin/vite"
for pair in "$HARDHAT:contract" "$VITE:client"; do
  bin="${pair%:*}"; where="${pair##*:}"
  [ -x "$bin" ] || { echo "$bin is missing. The install in '$where' did not finish. Delete that folder's node_modules and run this again."; exit 1; }
done

# ---------- blockchain -------------------------------------------------------
say "Starting the local blockchain"
(cd "$ROOT/contract" && "$HARDHAT" node > "$LOGS/chain.log" 2>&1) &
PIDS+=($!)
wait_port 8545 "The local blockchain" || exit 1
note "listening on http://127.0.0.1:8545"

# ---------- deploy -----------------------------------------------------------
say "Deploying the contracts"
(cd "$ROOT/contract" && "$HARDHAT" run scripts/deploy.ts --network localhost) > "$LOGS/deploy.log" 2>&1 || {
  echo "Deployment failed. See $LOGS/deploy.log"; exit 1; }
KYC=$(grep -o 'VITE_APP_KYC_MANAGER_ADDRESS=.*' "$LOGS/deploy.log" | cut -d= -f2 | tr -d '\r')
ADDR=$(grep -o 'VITE_APP_CONTRACT_ADDRESS=.*' "$LOGS/deploy.log" | cut -d= -f2 | tr -d '\r')
BLOCK=$(grep -o 'VITE_APP_DEPLOY_BLOCK=.*' "$LOGS/deploy.log" | cut -d= -f2 | tr -d '\r')
[ -n "$ADDR" ] || { echo "Could not read the contract address. See $LOGS/deploy.log"; exit 1; }
note "ClearCause at $ADDR"

# ---------- website configuration -------------------------------------------
ENVFILE="$ROOT/client/.env"
set_env "$ENVFILE" VITE_APP_CHAIN localhost
set_env "$ENVFILE" VITE_ENABLE_DEMO_WALLET true
set_env "$ENVFILE" VITE_APP_RPC_URL "http://127.0.0.1:8545"
set_env "$ENVFILE" VITE_APP_KYC_MANAGER_ADDRESS "$KYC"
set_env "$ENVFILE" VITE_APP_CONTRACT_ADDRESS "$ADDR"
set_env "$ENVFILE" VITE_APP_DEPLOY_BLOCK "$BLOCK"
set_env "$ENVFILE" VITE_FRAUD_API_URL "http://localhost:4000"
[ -n "$REOWN_ID" ] && set_env "$ENVFILE" VITE_APP_APPKIT_PROJECT_ID "$REOWN_ID"
if ! grep -q "^VITE_APP_APPKIT_PROJECT_ID=." "$ENVFILE"; then
  note "No Reown project id set. WalletConnect is disabled; injected wallets remain available."
  note "Get a free one at https://cloud.reown.com and rerun with --reown-id <id>."
fi

# ---------- anomaly model (optional) ----------------------------------------
ML_URL=""
if [ -n "$PYTHON" ]; then
  if [ -f "$ROOT/fraud/ml/model/isolation_forest.joblib" ]; then
    say "Starting the anomaly model"
    (cd "$ROOT/fraud/ml" && "$PYTHON" serve.py --model model --port 5001 > "$LOGS/model.log" 2>&1) &
    PIDS+=($!)
    if wait_port 5001 "The anomaly model" 20; then
      ML_URL="http://127.0.0.1:5001"; note "listening on $ML_URL"
    else
      note "The model did not start, so the rules will run on their own. See $LOGS/model.log"
    fi
  else
    note "No trained model found, so the rules will run on their own."
    note "To train one: cd fraud/ml && pip install -r requirements.txt && python generate_data.py && python train.py"
  fi
fi

# ---------- demo data --------------------------------------------------------
if [ "$NO_SEED" -eq 0 ]; then
  say "Creating the demo campaigns (this takes a minute)"
  (cd "$ROOT/fraud/service" && ML_URL="$ML_URL" NO_ACT=1 node scripts/integration-demo.mjs) \
    > "$LOGS/seed.log" 2>&1 || note "Seeding reported a problem. See $LOGS/seed.log"
  grep -E "^(Seeded|Scan|PASS|FAIL)" "$LOGS/seed.log" | while read -r line; do note "$line"; done
fi

# ---------- fraud service ----------------------------------------------------
say "Starting the fraud-detection service"
(cd "$ROOT/fraud/service" && ML_URL="$ML_URL" PORT=4000 POLL_MS=10000 node src/server.js > "$LOGS/fraud.log" 2>&1) &
PIDS+=($!)
wait_port 4000 "The fraud service" || exit 1
note "listening on http://localhost:4000"

# ---------- website ----------------------------------------------------------
say "Starting the website"
(cd "$ROOT/client" && "$VITE" --host 127.0.0.1 --port 5173 > "$LOGS/web.log" 2>&1) &
PIDS+=($!)
wait_port 5173 "The website" || exit 1

cat <<EOF

  ClearCause is running
  ---------------------
  Website        http://localhost:5173
  Fraud service  http://localhost:4000/api/risk
  Blockchain     http://127.0.0.1:8545  (chain id 31337)

  To sign in as the administrator:
    1. In MetaMask add a network: RPC http://127.0.0.1:8545, chain id 31337, symbol ETH
    2. Import the FIRST private key printed in logs/chain.log
       (these are public test keys and hold no real money)
    3. Open http://localhost:5173/dashboard/admin to review campaigns

  Press Ctrl+C to stop everything.

EOF

wait
