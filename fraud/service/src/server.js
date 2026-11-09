// Fraud-detection REST API.
//   GET  /health
//   GET  /api/risk            all campaigns, highest risk first (?flagged=1 for flagged only)
//   GET  /api/risk/:id        one campaign with reasons and features
//   POST /api/rescan          re-read the chain and re-score now
//
// Configuration (environment variables):
//   RPC_URL          default http://127.0.0.1:8545
//   CONTRACT_ADDRESS   or read from DEPLOYMENT_FILE (default ../../contract/deployments/localhost.json)
//   ABI_FILE         default ../../client/src/abis/ClearCause.json
//   ML_URL           optional, e.g. http://127.0.0.1:5001 (the Python model service)
//   PORT             default 4000
//   POLL_MS          rescan interval, default 15000 (0 disables)
//   FROM_BLOCK       first block to read, default from the deployment file
// Production additionally requires DATABASE_URL, DATA_ENCRYPTION_KEY, CORS_ORIGIN,
// KYC_MANAGER_ADDRESS, KYC_UPLOAD_DIR and CAMPAIGN_UPLOAD_DIR.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import { fetchSnapshot } from "./chain.js";
import { scan } from "./scanner.js";
import { createConfiguredIdentityStore } from "./identity-store.js";
import { createIdentityRouter } from "./identity.js";
import { createConfiguredFraudStore } from "./fraud-store.js";
import { createAdminGuard } from "./admin-auth.js";
import { createCampaignMediaRouter } from "./campaign-media.js";
import { allowedOrigins, createCorsOptions, createRateLimit, securityHeaders } from "./http-security.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const production = env.NODE_ENV === "production";
const deploymentFile = env.DEPLOYMENT_FILE || path.join(here, "../../../contract/deployments/localhost.json");
const abiFile = env.ABI_FILE || path.join(here, "../../../client/src/abis/ClearCause.json");

const deployment = fs.existsSync(deploymentFile) ? JSON.parse(fs.readFileSync(deploymentFile, "utf8")) : {};
const address = env.CONTRACT_ADDRESS || deployment.clearCause;
if (!address) {
  console.error("Set CONTRACT_ADDRESS or deploy first (contract/deployments/<network>.json not found).");
  process.exit(1);
}
const kycAddress = env.KYC_MANAGER_ADDRESS || deployment.kycManager;
if (!kycAddress) {
  console.error("Set KYC_MANAGER_ADDRESS or provide it in DEPLOYMENT_FILE.");
  process.exit(1);
}
const corsOrigins = allowedOrigins(env.CORS_ORIGIN || env.CORS_ORIGINS);
if (production) {
  const missing = [
    !env.DATABASE_URL && "DATABASE_URL",
    corsOrigins.size === 0 && "CORS_ORIGIN",
    !env.AUTH_DOMAIN && "AUTH_DOMAIN",
    !env.KYC_UPLOAD_DIR && "KYC_UPLOAD_DIR",
    !env.CAMPAIGN_UPLOAD_DIR && "CAMPAIGN_UPLOAD_DIR",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(", ")}`);
}
const abi = JSON.parse(fs.readFileSync(abiFile, "utf8"));
const provider = new ethers.JsonRpcProvider(env.RPC_URL || "http://127.0.0.1:8545");
const fromBlock = Number(env.FROM_BLOCK ?? deployment.deployBlock ?? 0);
const mlUrl = env.ML_URL || "";
const privateUploadDir = env.KYC_UPLOAD_DIR || path.join(here, "../data/kyc-documents");
const campaignUploadDir = env.CAMPAIGN_UPLOAD_DIR || path.join(here, "../data/campaign-images");
const identityStore = await createConfiguredIdentityStore(env.DATABASE_FILE || path.join(here, "../data/clearcause.json"));
const fraudStore = await createConfiguredFraudStore(env.FRAUD_DATABASE_FILE || path.join(here, "../data/fraud-scans.json"));
const kycOwnerContract = new ethers.Contract(kycAddress, ["function owner() view returns (address)"], provider);
const adminOnly = createAdminGuard({ store: identityStore, getAdminAddress: () => kycOwnerContract.owner() });

let latest = await fraudStore.getLatest();
let lastError = null;
let scanning = null;

async function rescan() {
  if (scanning) return scanning; // never run two scans at once
  scanning = (async () => {
    try {
      const snapshot = await fetchSnapshot({ provider, address, abi, fromBlock });
      const report = await scan(snapshot, { mlUrl });
      await fraudStore.saveScan(report);
      latest = report;
      lastError = null;
    } catch (err) {
      lastError = String(err.message || err);
      console.error("scan failed:", lastError);
    } finally {
      scanning = null;
    }
    return latest;
  })();
  return scanning;
}

export const app = express();
if (production) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders({ production }));
app.use(cors(createCorsOptions(corsOrigins, { production })));
app.use(express.json({ limit: "100kb" }));
app.use("/api/auth", createRateLimit({ windowMs: 60_000, max: 20 }));
app.use("/api/kyc", createRateLimit({ windowMs: 60_000, max: 30 }));
app.use("/api/campaign/image", createRateLimit({ windowMs: 60_000, max: 10 }));
app.use("/api/rescan", createRateLimit({ windowMs: 60_000, max: 5 }));
app.use("/api", createIdentityRouter({ store: identityStore, provider, kycAddress, uploadDir: privateUploadDir, authDomain: env.AUTH_DOMAIN }));
app.use("/api", createCampaignMediaRouter({ store: identityStore, uploadDir: campaignUploadDir, publicBaseUrl: env.PUBLIC_BASE_URL }));
app.use("/campaign-images", express.static(campaignUploadDir, { immutable: true, maxAge: "1y" }));

app.use((error, _req, res, next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "The image exceeds the upload size limit." });
  if (error?.statusCode === 403) return res.status(403).json({ error: error.message });
  return next(error);
});

app.get("/health", (_req, res) =>
  res.json({
    ok: !lastError,
    contract: address,
    mlConfigured: !!mlUrl,
    mlAvailable: latest?.mlAvailable ?? null,
    lastScan: latest?.scannedAt ?? null,
    error: lastError,
  }),
);

app.get("/api/risk", (req, res) => {
  if (!latest) return res.status(503).json({ error: "no scan yet", detail: lastError });
  const { results, ...meta } = latest;
  const rows = req.query.flagged ? results.filter((r) => r.flagged) : results;
  res.json({ ...meta, results: rows.map(({ features, ...r }) => r) });
});

app.get("/api/risk/history", async (req, res) => {
  res.json({ scans: await fraudStore.getHistory(req.query.limit) });
});

app.get("/api/risk/:id", (req, res) => {
  if (!latest) return res.status(503).json({ error: "no scan yet", detail: lastError });
  const r = latest.results.find((x) => String(x.campaignId) === req.params.id);
  if (!r) return res.status(404).json({ error: "campaign not found" });
  res.json(r);
});

app.post("/api/rescan", adminOnly, async (_req, res) => {
  await rescan();
  if (lastError || !latest) return res.status(503).json({ error: "scan failed", detail: lastError });
  res.json({ scannedAt: latest.scannedAt, total: latest.total, flagged: latest.flagged, mlAvailable: latest.mlAvailable });
});

// start only when run directly (so tests can import `app`)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(env.PORT || 4000);
  await rescan();
  app.listen(port, () => console.log(`fraud service on :${port}  contract ${address}  ml=${mlUrl || "off"}`));
  const poll = Number(env.POLL_MS ?? 15000);
  if (poll > 0) setInterval(rescan, poll).unref?.();
}
