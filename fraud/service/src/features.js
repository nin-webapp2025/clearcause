// Feature extraction for fraud detection.
//
// Input: a "snapshot", a plain list of campaigns with their donations. The same
// shape is produced from the blockchain (chain.js) and by the synthetic data
// generator (ml/generate_data.py), so the rules and the ML model always see
// exactly the same features.
//
//   campaign = {
//     id, owner, payout, target,            // addresses are hex strings, target in ETH
//     createdAt, approvedAt|null,           // unix seconds
//     donations: [{ donor, amount, ts }]    // amount in ETH
//   }

export const BURST_WINDOW_SECONDS = 600; // 10 minutes
export const FIRST_HOUR_SECONDS = 3600;
export const SERIAL_WINDOW_SECONDS = 86400; // 24 hours

export const FEATURE_NAMES = [
  "n_donations",
  "n_unique_donors",
  "repeat_ratio", // donations per distinct donor
  "raised_ratio", // raised / target
  "top_donor_share", // share of the money from the biggest donor
  "max_single_ratio", // biggest single donation / target
  "cv_amount", // spread of donation sizes (std / mean)
  "top_amount_repeat_share", // share of donations that use the most common amount
  "first_hour_share", // share of the money that arrived in the first hour
  "max_burst", // most donations inside any 10 minute window
  "interval_cv", // regularity of the time between donations (std / mean). Humans ~1, bots ~0
  "payout_differs", // 1 if the payout address is not the creator's own wallet
  "payout_shared_owners", // distinct creators tied to this payout address
  "owner_campaign_count", // campaigns created by the same wallet
  "owner_burst", // campaigns by the same wallet created within 24h of this one
  "payout_burst", // campaigns paying the same wallet (any creator) created within 24h of this one
  "self_donation_share", // share of the money donated by the creator or the payout wallet
];

const lower = (a) => (a ? String(a).toLowerCase() : "");
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const mean = (xs) => (xs.length ? sum(xs) / xs.length : 0);
const std = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / xs.length);
};
const round6 = (x) => Math.round(x * 1e6) / 1e6;

/** Cross-campaign lookups needed by some features. Build once per snapshot. */
export function buildContext(campaigns) {
  const controllers = new Map(); // address -> Set(creator wallets tied to it)
  const byOwner = new Map(); // creator -> [campaigns]
  const byPayout = new Map(); // payout address -> [campaigns]
  const tie = (addr, owner) => {
    if (!controllers.has(addr)) controllers.set(addr, new Set());
    controllers.get(addr).add(owner);
  };
  for (const c of campaigns) {
    const owner = lower(c.owner);
    const payout = lower(c.payout) || owner;
    tie(owner, owner);
    tie(payout, owner);
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push(c);
    if (!byPayout.has(payout)) byPayout.set(payout, []);
    byPayout.get(payout).push(c);
  }
  return { controllers, byOwner, byPayout };
}

export function extractFeatures(campaign, ctx) {
  const owner = lower(campaign.owner);
  const payout = lower(campaign.payout) || owner;
  const donations = [...(campaign.donations || [])].sort((a, b) => a.ts - b.ts);
  const amounts = donations.map((d) => Number(d.amount));
  const raised = sum(amounts);
  const target = Number(campaign.target) || 1;
  const n = donations.length;

  // donors
  const perDonor = new Map();
  for (const d of donations) {
    const k = lower(d.donor);
    perDonor.set(k, (perDonor.get(k) || 0) + Number(d.amount));
  }
  const unique = perDonor.size;
  const topDonor = n ? Math.max(...perDonor.values()) : 0;

  // amounts
  const m = mean(amounts);
  const counts = new Map();
  for (const a of amounts) {
    const k = a.toFixed(6);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const topRepeat = n ? Math.max(...counts.values()) : 0;

  // timing
  const start = campaign.approvedAt ?? campaign.createdAt;
  const firstHour = sum(
    donations.filter((d) => d.ts - start <= FIRST_HOUR_SECONDS).map((d) => Number(d.amount)),
  );
  let maxBurst = 0;
  for (let i = 0, j = 0; i < n; i++) {
    while (donations[i].ts - donations[j].ts > BURST_WINDOW_SECONDS) j++;
    maxBurst = Math.max(maxBurst, i - j + 1);
  }
  let intervalCv = 1; // neutral value when there is too little data
  if (n >= 3) {
    const gaps = donations.slice(1).map((d, i) => d.ts - donations[i].ts);
    const gm = mean(gaps);
    intervalCv = gm > 0 ? std(gaps) / gm : 0;
  }

  // creator behaviour
  const mine = ctx.byOwner.get(owner) || [campaign];
  const ownerBurst = mine.filter(
    (c) => Math.abs(c.createdAt - campaign.createdAt) <= SERIAL_WINDOW_SECONDS,
  ).length;

  const sharing = ctx.byPayout.get(payout) || [campaign];
  const payoutBurst = sharing.filter(
    (c) => Math.abs(c.createdAt - campaign.createdAt) <= SERIAL_WINDOW_SECONDS,
  ).length;

  // self funding
  const selfMoney = sum(
    donations.filter((d) => lower(d.donor) === owner || lower(d.donor) === payout).map((d) => Number(d.amount)),
  );

  return {
    n_donations: n,
    n_unique_donors: unique,
    repeat_ratio: round6(n / Math.max(1, unique)),
    raised_ratio: round6(raised / target),
    top_donor_share: round6(raised > 0 ? topDonor / raised : 0),
    max_single_ratio: round6(n ? Math.max(...amounts) / target : 0),
    cv_amount: round6(m > 0 ? std(amounts) / m : 0),
    top_amount_repeat_share: round6(n ? topRepeat / n : 0),
    first_hour_share: round6(raised > 0 ? firstHour / raised : 0),
    max_burst: maxBurst,
    interval_cv: round6(intervalCv),
    payout_differs: payout !== owner ? 1 : 0,
    payout_shared_owners: (ctx.controllers.get(payout) || new Set([owner])).size,
    owner_campaign_count: mine.length,
    owner_burst: ownerBurst,
    payout_burst: payoutBurst,
    self_donation_share: round6(raised > 0 ? selfMoney / raised : 0),
  };
}

/** Features for every campaign in a snapshot, keyed in the same order. */
export function extractAll(campaigns) {
  const ctx = buildContext(campaigns);
  return campaigns.map((c) => ({ id: c.id, features: extractFeatures(c, ctx) }));
}
