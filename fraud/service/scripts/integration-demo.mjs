// End-to-end demo on a LOCAL chain:
//   1. seed honest and fraudulent campaigns through the real contract
//   2. read them back from the chain, score them (rules + ML if ML_URL is set)
//   3. compare with the ground truth we planted
//   4. act as the human admin: suspend the campaigns the service recommends, then let a donor claim a refund
//
//   terminal 1:  cd contract && npx hardhat node
//   terminal 2:  cd contract && npm run deploy:local
//   terminal 3:  cd fraud/ml && python serve.py            (optional, adds the anomaly model)
//   terminal 4:  cd fraud/service && ML_URL=http://127.0.0.1:5001 node scripts/integration-demo.mjs
import fs from "node:fs";
import { ethers } from "ethers";
import { fetchSnapshot } from "../src/chain.js";
import { scan } from "../src/scanner.js";

const dep = JSON.parse(fs.readFileSync(new URL("../../../contract/deployments/localhost.json", import.meta.url)));
const clearCauseAbi = JSON.parse(fs.readFileSync(new URL("../../../client/src/abis/ClearCause.json", import.meta.url)));
const kycAbi = JSON.parse(fs.readFileSync(new URL("../../../client/src/abis/KYCManager.json", import.meta.url)));
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
const signers = await Promise.all(Array.from({ length: 20 }, (_, i) => provider.getSigner(i)));
const [admin] = signers;
const clearCause = (s) => new ethers.Contract(dep.clearCause, clearCauseAbi, s);
const kyc = (s) => new ethers.Contract(dep.kycManager, kycAbi, s);
const eth = (x) => ethers.parseEther(String(x));
const wait = (tx) => tx.then((t) => t.wait());
const addr = (i) => signers[i].getAddress();
const advance = async (s) => {
  await provider.send("evm_increaseTime", [s]);
  await provider.send("evm_mine", []);
};

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) failed++;
};

async function kycFor(i) {
  const a = await addr(i);
  await wait(kyc(signers[i]).submitKYC(ethers.id(`demo-kyc-${i}`)));
  await wait(kyc(admin).verifyKYC(a, true));
}

/** create + (optionally set payout) + approve; returns campaign id */
async function launch(i, title, target, { payout = null, approve = true } = {}) {
  const now = (await provider.getBlock("latest")).timestamp;
  const r = await wait(
    clearCause(signers[i]).createCampaign(title, "demo", eth(target), now + 60 * 86400, "", [eth(target / 2), eth(target)]),
  );
  const ev = r.logs.map((l) => { try { return clearCause(admin).interface.parseLog(l); } catch { return null; } }).find((e) => e?.name === "CampaignCreated");
  const id = ev.args.campaignId;
  if (payout !== null) await wait(clearCause(signers[i]).setPayoutAddress(id, await addr(payout)));
  if (approve) await wait(clearCause(admin).approveCampaign(id));
  return Number(id);
}
const donate = (from, id, amount) => wait(clearCause(signers[from]).donateCampaign(id, { value: eth(amount) }));

// ---------- 1. seed ---------------------------------------------------------
console.log("Seeding scenarios...");
// Account 0 is the local demo administrator and is also the default wallet in
// the browser. Verify it so the complete create-and-review journey is usable.
for (const i of [0, 1, 2, 3, 4, 5, 6, 7]) await kycFor(i);
const truth = {}; // id -> expected (true = planted fraud)

// honest: varied donors, varied amounts, irregular timing over days
const honest1 = await launch(1, "Clean water for Birnin Kebbi", 5);
truth[honest1] = false;
const humanAmounts = [0.15, 0.4, 0.05, 0.3, 0.22, 0.6, 0.12];
const humanGaps = [3000, 41000, 9000, 70000, 15000, 120000, 5400];
for (let k = 0; k < humanAmounts.length; k++) {
  await advance(humanGaps[k]);
  await donate(8 + k, honest1, humanAmounts[k]);
}

// honest: a charity paying out to its own organisation wallet
const honest2 = await launch(2, "School feeding programme", 4, { payout: 14 });
truth[honest2] = false;
for (let k = 0; k < 5; k++) {
  await advance([20000, 3000, 90000, 7000, 50000][k]);
  await donate(9 + k, honest2, [0.25, 0.1, 0.5, 0.07, 0.33][k]);
}

// fraud: creator funds own campaign to fake momentum
const selfFund = await launch(3, "Urgent medical appeal", 4);
truth[selfFund] = true;
await advance(7000);
await donate(15, selfFund, 0.1);
await advance(30000);
await donate(3, selfFund, 1.2); // creator pays into own campaign
await advance(9000);
await donate(3, selfFund, 0.8);

// fraud: bot burst, many wallets, identical amounts, seconds apart
const burst = await launch(4, "Flood relief (viral)", 3);
truth[burst] = true;
for (let k = 0; k < 11; k++) await donate(8 + (k % 10), burst, 0.2);

// fraud: ring, two fresh creators launched back-to-back, same beneficiary wallet
const ring1 = await launch(5, "Orphans fund A", 3, { payout: 19 });
const ring2 = await launch(6, "Orphans fund B", 3, { payout: 19 });
truth[ring1] = true;
truth[ring2] = true;
for (const id of [ring1, ring2]) {
  await advance(12000);
  await donate(10, id, 0.3);
  await advance(26000);
  await donate(11, id, 0.45);
}

// fraud: serial campaign spam from one wallet
const serial = [];
for (let k = 0; k < 4; k++) {
  const id = await launch(7, `Quick fundraiser ${k + 1}`, 2);
  serial.push(id);
  truth[id] = true;
  await advance(1800);
}
console.log(`Seeded ${Object.keys(truth).length} campaigns (${Object.values(truth).filter(Boolean).length} planted as fraud)`);

// ---------- 2. read from chain and score -----------------------------------
const snapshot = await fetchSnapshot({ provider, address: dep.clearCause, abi: clearCauseAbi, fromBlock: dep.deployBlock ?? 0 });
const report = await scan(snapshot, { mlUrl: process.env.ML_URL });
console.log(`\nScan: ${report.total} campaigns, ${report.flagged} flagged, ML ${report.mlAvailable ? "on" : "off"}`);
console.log("id  score  level   flagged  planted  rules");
for (const r of [...report.results].sort((a, b) => a.campaignId - b.campaignId)) {
  console.log(
    `${String(r.campaignId).padEnd(3)} ${String(r.score).padStart(5)}  ${r.level.padEnd(6)}  ${String(r.flagged).padEnd(7)}  ${String(truth[r.campaignId]).padEnd(7)}  ${r.reasons.map((x) => x.rule).join(",")}`,
  );
}

// ---------- 3. compare with ground truth ----------------------------------
const byId = new Map(report.results.map((r) => [r.campaignId, r]));
check("honest campaigns are not flagged", [honest1, honest2].every((id) => !byId.get(id).flagged));
check("self-funded campaign flagged", byId.get(selfFund).flagged, byId.get(selfFund).reasons.map((r) => r.rule).join(","));
check("bot burst flagged", byId.get(burst).flagged, byId.get(burst).reasons.map((r) => r.rule).join(","));
check("payout ring flagged", byId.get(ring1).flagged && byId.get(ring2).flagged);
check("serial campaigns flagged (needs the ML model)", serial.every((id) => byId.get(id).flagged));
check("every flagged campaign has human-readable reasons", report.results.filter((r) => r.flagged).every((r) => r.reasons.length > 0));

if (process.env.NO_ACT) {
  console.log("\nNO_ACT set: leaving the flagged campaigns live so the admin screen can be tried by hand.");
  process.exit(failed ? 1 : 0);
}

// ---------- 4. human-in-the-loop action -----------------------------------
const toSuspend = report.results.filter((r) => r.recommendation === "consider_suspension" && truth[r.campaignId]);
console.log(`\nAdmin reviews the dashboard and suspends ${toSuspend.length} recommended live campaigns...`);
for (const r of toSuspend) {
  await wait(clearCause(admin).suspendCampaign(r.campaignId, `Fraud service: ${r.reasons.map((x) => x.rule).join(", ")}`));
}
if (toSuspend.some((r) => r.campaignId === burst)) {
  const donorAddr = await addr(8);
  const blockBefore = await provider.getBlockNumber();
  const before = await provider.getBalance(donorAddr, blockBefore); // explicit block: ethers v6 caches "latest" briefly
  const receipt = await wait(clearCause(signers[8]).claimRefund(burst));
  const after = await provider.getBalance(donorAddr, receipt.blockNumber);
  const gasCost = receipt.gasUsed * receipt.gasPrice;
  check("donor to a suspended campaign gets the full refund back", after - before + gasCost === eth(0.4), `${ethers.formatEther(after - before + gasCost)} ETH refunded`);
  const donateAfter = await donate(12, burst, 0.1).then(() => false, () => true);
  check("suspended campaign no longer accepts donations", donateAfter);
}

const after = await fetchSnapshot({ provider, address: dep.clearCause, abi: clearCauseAbi, fromBlock: dep.deployBlock ?? 0 });
check("suspension is visible on-chain", after.campaigns.filter((c) => c.status === "Suspended").length === toSuspend.length);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
