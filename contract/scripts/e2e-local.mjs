// End-to-end check of the whole flow against a LOCAL chain, using the same ABI,
// status labels and event helper that the React client uses.
//
//   terminal 1:  npx hardhat node
//   terminal 2:  npm run deploy:local && node scripts/e2e-local.mjs
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { findEvent, withRevertName } from "../../client/src/lib/receiptEvents.js";
import { CAMPAIGN_STATUS, REFUNDABLE } from "../../client/src/constant/campaignStatus.js";

const dep = JSON.parse(readFileSync(new URL("../deployments/localhost.json", import.meta.url)));
const clearCauseAbi = JSON.parse(readFileSync(new URL("../../client/src/abis/ClearCause.json", import.meta.url)));
const kycAbi = JSON.parse(readFileSync(new URL("../../client/src/abis/KYCManager.json", import.meta.url)));

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const [admin, creator, donor, charity, stranger] = await Promise.all(
  [0, 1, 2, 3, 4].map((i) => provider.getSigner(i)),
);
const clearCause = (s) => new ethers.Contract(dep.clearCause, clearCauseAbi, s);
const kyc = (s) => new ethers.Contract(dep.kycManager, kycAbi, s);

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) failed++;
};
// Uses the client's own error decoder, so this also tests what the UI will show.
const reverts = async (p, name) => {
  try {
    await (await p).wait?.();
    return false;
  } catch (e) {
    withRevertName(e, clearCause(admin));
    return e.message.includes(name);
  }
};
const statusOf = async (id) => CAMPAIGN_STATUS[Number((await clearCause(admin).getCampaign(id)).status)];
const now = async () => (await provider.getBlock("latest")).timestamp;

// ---- setup: KYC for the creator
const creatorAddr = await creator.getAddress();
const donorAddr = await donor.getAddress();
const charityAddr = await charity.getAddress();
await (await kyc(creator).submitKYC(ethers.id("creator-proof"))).wait();
await (await kyc(admin).verifyKYC(creatorAddr, true)).wait();

// ---- admin role check (same call as useIsAdmin)
const ADMIN_ROLE = ethers.id("ADMIN_ROLE");
check("admin wallet holds ADMIN_ROLE", await clearCause(admin).hasRole(ADMIN_ROLE, await admin.getAddress()));
check("creator wallet does not hold ADMIN_ROLE", !(await clearCause(admin).hasRole(ADMIN_ROLE, creatorAddr)));

// ---- campaign 1: full happy path with a different payout address
const deadline = (await now()) + 3 * 86400;
let tx = await clearCause(creator).createCampaign("Clean water", "Wells for 3 villages", ethers.parseEther("1"), deadline, "", [
  ethers.parseEther("0.5"),
  ethers.parseEther("1"),
]);
let receipt = await tx.wait();
const created = findEvent(receipt, clearCause(creator), "CampaignCreated");
check("findEvent decodes CampaignCreated from an ethers v6 receipt", !!created);
const id1 = Number(created.args.campaignId);
check("new campaign starts as Pending", (await statusOf(id1)) === "Pending");

check("donation to a Pending campaign is blocked", await reverts(clearCause(donor).donateCampaign(id1, { value: ethers.parseEther("0.1") }), "InvalidStatus"));
check("only the creator can set the payout address", await reverts(clearCause(stranger).setPayoutAddress(id1, charityAddr), "Unauthorized"));
await (await clearCause(creator).setPayoutAddress(id1, charityAddr)).wait();
check("getPayoutAddress returns the chosen address", (await clearCause(admin).getPayoutAddress(id1)) === charityAddr);
check("non-admin cannot approve", await reverts(clearCause(creator).approveCampaign(id1), "AccessControlUnauthorizedAccount"));

await (await clearCause(admin).approveCampaign(id1)).wait();
check("admin approval makes it Active", (await statusOf(id1)) === "Active");
check("payout address is locked after approval", await reverts(clearCause(creator).setPayoutAddress(id1, creatorAddr), "InvalidStatus"));

tx = await clearCause(donor).donateCampaign(id1, { value: ethers.parseEther("1") });
receipt = await tx.wait();
const donation = findEvent(receipt, clearCause(donor), "DonationMade");
check("findEvent decodes DonationMade (tokenId)", !!donation && donation.args.tokenId.toString() === "0", `tokenId=${donation?.args.tokenId}`);
check("reaching the target marks the campaign Successful", (await statusOf(id1)) === "Successful");

// same query useGetDonations runs
const logs = await clearCause(donor).queryFilter(clearCause(donor).filters.DonationMade(id1), 0);
check("donation history query returns the transaction hash", logs.length === 1 && logs[0].transactionHash === tx.hash, tx.hash.slice(0, 14) + "...");

const before = await provider.getBalance(charityAddr);
tx = await clearCause(creator).withdrawCampaignFunds(id1);
receipt = await tx.wait();
const paid = findEvent(receipt, clearCause(creator), "CampaignPaidOut");
const gained = (await provider.getBalance(charityAddr)) - before;
check("funds go to the approved payout address, not the creator", gained === ethers.parseEther("1"), `${ethers.formatEther(gained)} ETH`);
check("CampaignPaidOut reports the recipient", paid?.args.owner === charityAddr);
check("campaign ends as Paid", (await statusOf(id1)) === "Paid");

// ---- campaign 2: suspension and refund
const d2 = (await now()) + 3 * 86400;
receipt = await (await clearCause(creator).createCampaign("Medical fund", "Surgery costs", ethers.parseEther("5"), d2, "", [])).wait();
const id2 = Number(findEvent(receipt, clearCause(creator), "CampaignCreated").args.campaignId);
await (await clearCause(admin).approveCampaign(id2)).wait();
await (await clearCause(donor).donateCampaign(id2, { value: ethers.parseEther("0.4") })).wait();
await (await clearCause(donor).donateCampaign(id2, { value: ethers.parseEther("0.1") })).wait();

check("a non-admin cannot suspend", await reverts(clearCause(creator).suspendCampaign(id2, "x"), "AccessControlUnauthorizedAccount"));
receipt = await (await clearCause(admin).suspendCampaign(id2, "Fraud alert: duplicate beneficiary")).wait();
const susp = findEvent(receipt, clearCause(admin), "CampaignSuspended");
check("suspension reason is recorded on-chain", susp?.args.reason === "Fraud alert: duplicate beneficiary");
check("status is Suspended and counts as refundable in the UI", (await statusOf(id2)) === "Suspended" && REFUNDABLE.includes("Suspended"));
check("donations stop after suspension", await reverts(clearCause(stranger).donateCampaign(id2, { value: ethers.parseEther("0.1") }), "InvalidStatus"));

const donorBefore = await provider.getBalance(donorAddr);
receipt = await (await clearCause(donor).claimRefund(id2)).wait();
const refund = findEvent(receipt, clearCause(donor), "RefundClaimed");
const refunded = refund?.args.amount;
check("donor gets back the TOTAL of both donations", refunded === ethers.parseEther("0.5"), `${ethers.formatEther(refunded ?? 0n)} ETH`);
check("refund really arrives in the donor wallet", (await provider.getBalance(donorAddr)) > donorBefore);
check("second refund is blocked", await reverts(clearCause(donor).claimRefund(id2), "RefundAlreadyClaimed"));
const claimedLogs = await clearCause(donor).queryFilter(clearCause(donor).filters.RefundClaimed(id2, donorAddr), 0);
check("useHasClaimedRefund query sees the claim", claimedLogs.length === 1);

// ---- campaign 3: rejection
const d3 = (await now()) + 3 * 86400;
receipt = await (await clearCause(creator).createCampaign("Suspicious", "Send money fast", ethers.parseEther("2"), d3, "", [])).wait();
const id3 = Number(findEvent(receipt, clearCause(creator), "CampaignCreated").args.campaignId);
check("reject without admin role fails", await reverts(clearCause(creator).rejectCampaign(id3, "no"), "AccessControlUnauthorizedAccount"));
receipt = await (await clearCause(admin).rejectCampaign(id3, "Documents do not match")).wait();
check("rejection reason recorded", findEvent(receipt, clearCause(admin), "CampaignRejected")?.args.reason === "Documents do not match");
check("rejected campaign cannot receive donations", (await statusOf(id3)) === "Rejected" && (await reverts(clearCause(donor).donateCampaign(id3, { value: 1n }), "InvalidStatus")));

// ---- listing helper: same shape the client builds
const all = await clearCause(admin).getAllCampaigns();
const labels = all.map((c) => CAMPAIGN_STATUS[Number(c.status)]);
check("client status labels map every campaign", JSON.stringify(labels) === JSON.stringify(["Paid", "Suspended", "Rejected"]), labels.join(", "));

console.log(failed === 0 ? "\nAll end-to-end checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
