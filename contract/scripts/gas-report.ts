import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Measures the gas used by every user-facing function on a throw-away in-process chain.
 *
 *   npx hardhat run scripts/gas-report.ts
 *
 * Writes docs/gas-report.md and docs/gas-report.json.
 * Gas UNITS are exact and identical on any EVM chain running this code. The ETH / USD figures
 * depend on the gas price and ETH price, which are assumptions (see GAS_PRICE_GWEI, ETH_USD).
 */
const GAS_PRICE_GWEI = Number(process.env.GAS_PRICE_GWEI ?? "10");
const ETH_USD = Number(process.env.ETH_USD ?? "3000");
const e = (x: string | number) => ethers.parseEther(String(x));

type Row = { action: string; contract: string; gas: number; note?: string };
const rows: Row[] = [];
const rec = async (action: string, contract: string, txp: Promise<any>, note = "") => {
  const r = await (await txp).wait();
  rows.push({ action, contract, gas: Number(r.gasUsed), note });
  return r;
};

async function main() {
  const signers = await ethers.getSigners();
  const [admin, creator, donorA, donorB, charity] = signers;

  // ---- deployment
  const kycF = await ethers.getContractFactory("KYCManager");
  const kyc = await kycF.deploy();
  const kycRc = await kyc.deploymentTransaction()!.wait();
  rows.push({ action: "Deploy KYCManager", contract: "KYCManager", gas: Number(kycRc!.gasUsed), note: "one-time" });
  const clearCauseF = await ethers.getContractFactory("ClearCause");
  const clearCause = await clearCauseF.deploy(await kyc.getAddress(), 3);
  const fRc = await clearCause.deploymentTransaction()!.wait();
  rows.push({ action: "Deploy ClearCause", contract: "ClearCause", gas: Number(fRc!.gasUsed), note: "one-time" });

  const f = (s: any) => clearCause.connect(s) as any;
  const k = (s: any) => kyc.connect(s) as any;

  // ---- KYC
  await rec("Submit KYC", "KYCManager", k(creator).submitKYC(ethers.id("creator-proof")));
  await rec("Verify KYC (admin)", "KYCManager", k(admin).verifyKYC(creator.address, true));
  await (await k(donorA).submitKYC(ethers.id("donor-proof"))).wait();
  await (await k(admin).verifyKYC(donorA.address, true)).wait();

  const now = async () => (await ethers.provider.getBlock("latest"))!.timestamp;
  const create = async (title: string, target: string, milestones: string[]) =>
    f(creator).createCampaign(title, "demo", e(target), (await now()) + 30 * 86400, "", milestones.map(e));

  // ---- campaign lifecycle
  const r1 = await rec("Create campaign (2 milestones)", "ClearCause", create("Water", "1", ["0.5", "1"]), "starts Pending");
  const id1 = 0;
  await rec("Set payout address", "ClearCause", f(creator).setPayoutAddress(id1, charity.address));
  await rec("Approve campaign (admin)", "ClearCause", f(admin).approveCampaign(id1));

  // second campaign to measure reject / suspend
  await rec("Create campaign (no milestones)", "ClearCause", create("Health", "5", []));
  await rec("Reject campaign (admin)", "ClearCause", f(admin).rejectCampaign(1, "Documents missing"));
  await (await create("Education", "5", [])).wait(); // id 2
  await (await f(admin).approveCampaign(2)).wait();

  // ---- donations: first, repeat donor, then how it scales with history
  await rec("Donate (first donation to a campaign)", "ClearCause", f(donorA).donateCampaign(2, { value: e("0.1") }), "mints receipt NFT");
  await rec("Donate (same donor, second time)", "ClearCause", f(donorA).donateCampaign(2, { value: e("0.1") }), "donor already has stats");
  await rec("Donate (new donor, campaign has 2 donations)", "ClearCause", f(donorB).donateCampaign(2, { value: e("0.1") }));
  const scale: Record<number, number> = {};
  for (let n = 3; n <= 100; n++) {
    const s = signers[5 + (n % 12)];
    const r = await (await f(s).donateCampaign(2, { value: e("0.001") })).wait();
    if ([25, 50, 100].includes(n)) scale[n] = Number(r.gasUsed);
  }
  for (const n of [25, 50, 100]) {
    rows.push({ action: `Donate (repeat donor, campaign already has ${n - 1} donations)`, contract: "ClearCause", gas: scale[n], note: "scaling check: should stay flat" });
  }

  // ---- payout path (campaign 0): fund to target, withdraw
  await (await f(donorA).donateCampaign(id1, { value: e("1") })).wait();
  await rec("Withdraw funds (successful campaign)", "ClearCause", f(creator).withdrawCampaignFunds(id1), "pays the approved payout address");

  // ---- suspend + refund (campaign 2)
  await rec("Suspend campaign (admin)", "ClearCause", f(admin).suspendCampaign(2, "Flagged by fraud service"), "opens refunds");
  await rec("Claim refund", "ClearCause", f(donorB).claimRefund(2));

  // ---- a failed campaign: let the deadline pass, check status, refund
  await (await create("Short", "2", [])).wait(); // id 3
  await (await f(admin).approveCampaign(3)).wait();
  await (await f(donorA).donateCampaign(3, { value: e("0.2") })).wait();
  await ethers.provider.send("evm_increaseTime", [31 * 86400]);
  await ethers.provider.send("evm_mine", []);
  await rec("Check campaign status (marks Failed)", "ClearCause", f(donorA).checkCampaignStatus(3));

  // ---- governance
  try {
    await rec(
      "Create milestone-adjustment proposal",
      "ClearCause",
      f(donorA).createProposal(2, "Adjust milestones", 3 * 86400, 1, [e("2"), e("5")]),
      "needs KYC"
    );
  } catch (err: any) {
    console.log("(createProposal skipped:", (err.shortMessage || err.message).slice(0, 80) + ")");
  }

  // ---- output
  const gwei = GAS_PRICE_GWEI;
  const cost = (gas: number) => (gas * gwei) / 1e9; // ETH
  const fmt = (n: number) => n.toLocaleString("en-US");
  const lines = [
    "# Gas report",
    "",
    `Measured on a local Hardhat chain with the optimiser enabled (runs=1). **Gas units are exact** and the same on any EVM chain running this code.`,
    `The ETH and USD columns are **estimates** using an assumed gas price of ${gwei} gwei and ETH = $${ETH_USD}. Real prices change daily; Sepolia test ETH has no value.`,
    "",
    "For scale: a plain ETH transfer costs 21,000 gas.",
    "",
    "| Action | Contract | Gas used | Est. ETH | Est. USD | Note |",
    "|---|---|---:|---:|---:|---|",
    ...rows.map((r) => `| ${r.action} | ${r.contract} | ${fmt(r.gas)} | ${cost(r.gas).toFixed(5)} | ${(cost(r.gas) * ETH_USD).toFixed(2)} | ${r.note ?? ""} |`),
    "",
  ];
  const dir = path.join(__dirname, "..", "docs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "gas-report.md"), lines.join("\n"));
  fs.writeFileSync(path.join(dir, "gas-report.json"), JSON.stringify({ gasPriceGwei: gwei, ethUsd: ETH_USD, rows }, null, 2));
  console.log(lines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
