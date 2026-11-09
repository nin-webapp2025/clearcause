# ClearCause client

React/Vite interface for campaign creators, donors and administrators. It reads from the configured ClearCause
deployment, connects wallets through Reown AppKit, and optionally displays recommendations from the read-only
fraud API.

Use the root `start-demo.ps1` on Windows for the complete local stack. For frontend-only development:

```shell
npm install --legacy-peer-deps
npm run dev
npm run lint
npm run build
```

The required contract addresses, chain, RPC URL and deployment block are supplied through `client/.env`. The
local launcher maintains those values automatically. Image uploads require explicit Cloudinary settings; never
submit real KYC information because demonstration KYC fields are stored publicly on-chain.
