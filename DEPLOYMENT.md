# ClearCause public deployment

The first public target should be a **Sepolia production-style demo**. It is internet-accessible and uses test ETH.
Do not accept real funds until the contracts have been independently audited and the KYC/privacy process has legal review.

## Services

| Service | Root directory | Build | Start |
|---|---|---|---|
| Frontend | `client` | `npm ci && npm run build` | deploy `dist` as a static Vite site |
| Node API | `fraud/service` | `npm ci` | `npm start` |
| ML API | `fraud/ml` | `pip install -r requirements.txt` | `gunicorn --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 30 "serve:create_app('model')"` |

Keep the ML API private. Only the Node API should be able to reach it. The Node API is public because the browser uses
its wallet authentication, KYC and fraud endpoints.

## 1. Deploy contracts

Copy `contract/.env.example` to `contract/.env`, supply a Sepolia RPC URL and a test-only deployer key, then run:

```powershell
cd contract
npm ci
npm test
npm run deploy:sepolia
```

Keep the printed KYC address, ClearCause address and deployment block. Verify both contracts on Etherscan. Before any
real-money deployment, transfer administration to a multisignature wallet and separate the KYC reviewer authority.

## 2. Create durable infrastructure

Create a managed PostgreSQL database and apply `fraud/service/db/postgres.sql`. Attach durable private storage to the
Node service and create separate `kyc-documents` and `campaign-images` directories. KYC storage must not be public.
Campaign images may instead use Cloudinary; production uploads should be backend-signed.

The Node service deliberately refuses to start in production if PostgreSQL, allowed origins, or durable upload paths
are absent. See `fraud/service/.env.production.example` for every required variable.

## 3. Deploy backend services

Deploy the ML API first and set its internal URL as `ML_URL` on the Node service. Deploy the Node API with
`NODE_ENV=production`, a long random `DATA_ENCRYPTION_KEY`, the PostgreSQL URL, contract addresses, Sepolia RPC URL,
and the exact frontend origin. Set `AUTH_DOMAIN` to the frontend hostname and use `https://api.<domain>` as
`PUBLIC_BASE_URL`.

Use one Node instance for the current scanner. Multiple instances would duplicate periodic scans unless a distributed
lock or dedicated background worker is added.

Verify:

```text
GET https://api.<domain>/health
GET https://api.<domain>/api/risk
```

## 4. Deploy frontend

Configure the variables from `client/.env.example`. Required production values include:

```dotenv
VITE_APP_CHAIN=sepolia
VITE_ENABLE_DEMO_WALLET=false
VITE_APP_RPC_URL=https://...
VITE_APP_EXPLORER_URL=https://sepolia.etherscan.io
VITE_APP_KYC_MANAGER_ADDRESS=0x...
VITE_APP_CONTRACT_ADDRESS=0x...
VITE_APP_DEPLOY_BLOCK=...
VITE_APP_APPKIT_PROJECT_ID=...
VITE_FRAUD_API_URL=https://api.<domain>
```

Use sibling domains such as `app.clearcause.example` and `api.clearcause.example`. The API cookie is `Secure`,
HTTP-only and SameSite=Lax in production, and CORS accepts only `CORS_ORIGIN` (or a comma-separated `CORS_ORIGINS`).

## 5. Release checks

1. Run contract, Node and Python tests plus frontend lint/build.
2. Test MetaMask and WalletConnect on mobile and desktop.
3. Complete KYC submit/review, campaign approval, donation, transaction link, fraud rescan, suspension and refund.
4. Confirm an unapproved web origin receives HTTP 403 from the API.
5. Restart every service and confirm sessions, KYC metadata, uploads and fraud history survive.
6. Enable database backups, uptime monitoring, centralized error logs and secret rotation.
7. Publish a privacy notice and document KYC retention/deletion procedures.

## Cost expectation

A temporary Sepolia demo can fit within several providers' free tiers, but sleeping services and expiring databases make
that unsuitable for an always-available presentation. A durable deployment normally incurs small monthly compute,
database, storage, RPC and domain charges. Sepolia contract gas is test ETH; mainnet deployment and transactions are not free.
