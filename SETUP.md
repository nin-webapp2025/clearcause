# Setup guide

You need: **Node.js 20 LTS** (22 also works, Hardhat just prints a warning), **Git**, and the **MetaMask** browser extension.
Python 3 is optional; without it the fraud rules still run, just not the anomaly model.

## 0. The quick way: one command
From the project folder:
```powershell
powershell -ExecutionPolicy Bypass -File .\start-demo.ps1      # Windows
```
```bash
./start-demo.sh                                                 # macOS or Linux
```
This installs anything missing, starts the local blockchain, deploys the contracts, creates ten demo campaigns
(two honest, eight fraudulent), starts the anomaly model and the fraud service, writes `client/.env`, and opens
the website at http://127.0.0.1:5173. Press Ctrl+C to stop everything. Logs are written to `logs/`.

Useful switches: `-NoSeed` / `--no-seed` for an empty platform, `-NoMl` / `--no-ml` to skip Python,
and `-ReownProjectId <id>` / `--reown-id <id>` to save your wallet-connect id.

The launcher enables a built-in **Demo** wallet backed by Hardhat's first unlocked test account, so the local demo works
without a browser extension. That account is the administrator. You can still use MetaMask instead by adding RPC
`http://127.0.0.1:8545`, chain id `31337`, symbol `ETH`, and importing a test key from `logs/chain.log`. These accounts
and keys are public test fixtures with no real value; never use them on a live network.

For local KYC demonstrations, ID images are accepted by the Node service and stored privately in
`fraud/service/data/kyc-documents`. Use sample images only.

Wallet authentication uses a short-lived nonce and signature; the backend session is held in an HTTP-only cookie.
Local user and KYC records persist in the gitignored `fraud/service/data` directory. The PostgreSQL production schema is
in `fraud/service/db/postgres.sql`. KYC documents are private backend files and only a proof hash is written on-chain.
Set `DATABASE_URL` on the Node service to switch from the local durable adapter to PostgreSQL. Set a long random
`DATA_ENCRYPTION_KEY` before any deployed use; production startup fails when this key is absent.

The sections below do the same thing step by step, which is what you want when something goes wrong.

## 1. Contracts: install and test
```bash
cd contract
npm install
npm test            # 47 tests should pass
```

## 2. Try everything locally (no real money, no accounts)
Terminal 1:
```bash
cd contract
npm run node        # starts a local blockchain and prints 20 test accounts
```
Terminal 2:
```bash
cd contract
npm run deploy:local          # deploys, copies the ABI into the client, prints the .env lines
node scripts/e2e-local.mjs    # 28 end-to-end checks of the full flow
```

## 3. Run the website
```bash
cd client
npm install --legacy-peer-deps
cp .env.example .env          # then fill it in (see below)
npm run dev
```
In `client/.env` for local testing:
- `VITE_APP_CHAIN=localhost`
- `VITE_ENABLE_DEMO_WALLET=true` to permit the unlocked Hardhat demo account
- the two contract addresses and `VITE_APP_DEPLOY_BLOCK` printed by `deploy:local`
- `VITE_APP_APPKIT_PROJECT_ID`: free, from https://cloud.reown.com

In MetaMask add the network `http://127.0.0.1:8545`, chain ID `31337`, and import one of the test accounts printed by
`npm run node` (test accounts only, never for real funds). The first account is the **admin**.

## 4. Roles (how to demo it)
1. **Creator:** open the KYC page and submit the form.
2. **Admin:** on the KYC page verify the creator.
3. **Creator:** create a campaign. It is `Pending`.
4. **Admin:** open *Campaign Review* in the sidebar, approve it.
5. **Donor:** donate. The donation shows a transaction hash.
6. **Admin:** suspend a campaign to see donors get refunds.

## 4b. Fraud detection (optional but part of the project)
See `fraud/README.md` for the full steps. Short version, after step 2 is running (local chain deployed):
```bash
cd fraud/ml && pip install -r requirements.txt && python generate_data.py && python train.py && python serve.py   # model + scoring API
cd fraud/service && npm install && npm test && ML_URL=http://127.0.0.1:5001 npm start                          # API on :4000
```
Put `VITE_FRAUD_API_URL=http://127.0.0.1:4000` in `client/.env`, restart the website and open the admin Campaign Review page.
`node scripts/integration-demo.mjs` (in `fraud/service`) runs a complete seeded scenario on a fresh local chain.

## 5. Deploy to Sepolia (public test network)
```bash
cd contract
cp .env.example .env
# fill SEPOLIA_RPC_URL (free from Alchemy or Infura) and PRIVATE_KEY of a THROWAWAY wallet
# that only holds Sepolia test ETH (get it from a Sepolia faucet)
npm run deploy:sepolia
```
Copy the printed lines into `client/.env` and set `VITE_APP_CHAIN=sepolia`.

For Sepolia and every deployed environment, set `VITE_ENABLE_DEMO_WALLET=false`. The application also enforces this in
code: the demo provider cannot activate unless `VITE_APP_CHAIN=localhost`. Use MetaMask or configure WalletConnect with
your own `VITE_APP_APPKIT_PROJECT_ID`; never put a wallet private key in the React application.

**Never share or commit your `.env` files, and never use a wallet that holds real funds.**

For the hosted frontend, Node API, PostgreSQL database, private ML API and durable uploads, continue with
[`DEPLOYMENT.md`](DEPLOYMENT.md). The local launcher is not used in a hosted environment.
