// Reads campaigns and donations from the ClearCause contract and returns a snapshot
// in the format features.js expects. Read-only: this service holds NO keys and
// cannot suspend anything; it only recommends, the admin acts in the UI.

import { ethers } from "ethers";

export const STATUS = ["Active", "Successful", "Failed", "Paid", "Pending", "Rejected", "Suspended"];

async function queryChunked(contract, eventName, fromBlock, toBlock, chunk) {
  const out = [];
  let from = fromBlock;
  let size = chunk;
  while (from <= toBlock) {
    const to = Math.min(from + size - 1, toBlock);
    try {
      out.push(...(await contract.queryFilter(eventName, from, to)));
      from = to + 1;
    } catch (err) {
      // public RPCs limit the block range; halve and retry
      if (size <= 10) throw err;
      size = Math.floor(size / 2);
    }
  }
  return out;
}

export async function fetchSnapshot({ provider, address, abi, fromBlock = 0, chunk = 50000 }) {
  const clearCause = new ethers.Contract(address, abi, provider);
  // eth_blockNumber directly: provider.getBlockNumber() is cached for a few seconds in ethers v6
  const latest = parseInt(await provider.send("eth_blockNumber", []), 16);

  const [created, donations, approved] = await Promise.all([
    queryChunked(clearCause, "CampaignCreated", fromBlock, latest, chunk),
    queryChunked(clearCause, "DonationMade", fromBlock, latest, chunk),
    queryChunked(clearCause, "CampaignApproved", fromBlock, latest, chunk),
  ]);

  const tsCache = new Map();
  const tsOf = async (blockNumber) => {
    if (!tsCache.has(blockNumber)) tsCache.set(blockNumber, (await provider.getBlock(blockNumber)).timestamp);
    return tsCache.get(blockNumber);
  };

  const byId = new Map();
  for (const ev of created) {
    const id = Number(ev.args.campaignId);
    byId.set(id, {
      id,
      owner: ev.args.owner,
      title: ev.args.title,
      target: Number(ethers.formatEther(ev.args.target)),
      createdAt: await tsOf(ev.blockNumber),
      approvedAt: null,
      donations: [],
    });
  }
  for (const ev of approved) {
    const c = byId.get(Number(ev.args.campaignId));
    if (c) c.approvedAt = await tsOf(ev.blockNumber);
  }
  for (const ev of donations) {
    const c = byId.get(Number(ev.args.campaignId));
    if (!c) continue;
    c.donations.push({
      donor: ev.args.donator,
      amount: Number(ethers.formatEther(ev.args.amount)),
      ts: await tsOf(ev.blockNumber),
      tx: ev.transactionHash,
    });
  }

  // current on-chain state is authoritative for status and payout address
  for (const c of byId.values()) {
    const [campaign, payout] = await Promise.all([clearCause.getCampaign(c.id), clearCause.getPayoutAddress(c.id)]);
    c.status = STATUS[Number(campaign.status)];
    c.payout = payout;
  }
  return { campaigns: [...byId.values()].sort((a, b) => a.id - b.id), block: latest };
}
