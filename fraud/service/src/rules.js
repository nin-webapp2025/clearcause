// Rule-based fraud detection.
//
// Each rule looks at the features of one campaign and, if it fires, adds its
// weight to the risk score (capped at 100). Weights were set from the charity
// fraud typologies, NOT tuned on the evaluation data:
//   - signals that are almost never innocent get large weights,
//   - signals that have innocent explanations (a big donor, a shared charity
//     wallet) get small weights, so one of them alone never flags a campaign.

export const FLAG_THRESHOLD = 40; // score at which a campaign is sent to the admin as suspicious
export const HIGH_THRESHOLD = 60;

export const RULES = [
  {
    id: "SELF_DONATION",
    title: "Creator funds their own campaign",
    test: (f) => f.self_donation_share >= 0.02,
    weight: (f) => (f.self_donation_share >= 0.2 ? 45 : 25),
    message: (f) =>
      `${pct(f.self_donation_share)} of the money came from the creator's own wallet or the payout wallet (can fake momentum)`,
  },
  {
    id: "SHARED_PAYOUT",
    title: "Same payout wallet behind several creators",
    test: (f) => f.payout_shared_owners >= 2,
    weight: () => 30,
    message: (f) =>
      `The payout wallet is tied to ${f.payout_shared_owners} different creators (duplicate beneficiary or money mule pattern)`,
  },
  {
    id: "PAYOUT_RING",
    title: "Campaigns for one payout wallet launched together",
    test: (f) => f.payout_shared_owners >= 2 && f.payout_burst >= 2,
    weight: () => 25,
    message: (f) =>
      `${f.payout_burst} campaigns paying the same wallet were created within 24 hours (coordinated launch)`,
  },
  {
    id: "SERIAL_CAMPAIGNS",
    title: "Many campaigns created at once",
    test: (f) => f.owner_burst >= 3,
    weight: () => 30,
    message: (f) => `${f.owner_burst} campaigns by the same creator within 24 hours`,
  },
  {
    id: "BURST",
    title: "Burst of donations",
    test: (f) => f.max_burst >= 8,
    weight: () => 20,
    message: (f) => `${f.max_burst} donations inside a 10-minute window`,
  },
  {
    id: "DONOR_CONCENTRATION",
    title: "One donor provides almost everything",
    test: (f) => f.top_donor_share >= 0.9 && f.n_donations >= 2,
    weight: () => 15,
    message: (f) => `One wallet gave ${pct(f.top_donor_share)} of the money`,
  },
  {
    id: "IDENTICAL_AMOUNTS",
    title: "Repeated identical donation amounts",
    test: (f) => f.n_donations >= 6 && f.top_amount_repeat_share >= 0.7,
    weight: () => 20,
    message: (f) => `${pct(f.top_amount_repeat_share)} of donations have exactly the same amount (typical of scripts)`,
  },
  {
    id: "REGULAR_INTERVALS",
    title: "Machine-like timing",
    test: (f) => f.n_donations >= 6 && f.interval_cv <= 0.25,
    weight: () => 25,
    message: (f) => `Donations arrive at suspiciously regular intervals (variation ${f.interval_cv.toFixed(2)}, humans are near 1)`,
  },
  {
    id: "PAYOUT_DIFFERS",
    title: "Payout goes to another wallet",
    test: (f) => f.payout_differs === 1,
    weight: () => 5,
    message: () => "The payout wallet is not the creator's wallet (normal for charities, but the admin should check it)",
  },
];

const pct = (x) => `${Math.round(x * 100)}%`;

export function levelOf(score) {
  if (score >= HIGH_THRESHOLD) return "high";
  if (score >= FLAG_THRESHOLD) return "medium";
  return "low";
}

/** Evaluate all rules for one campaign's features. */
export function evaluateRules(features) {
  const reasons = [];
  let score = 0;
  for (const rule of RULES) {
    if (rule.test(features)) {
      const weight = rule.weight(features);
      score += weight;
      reasons.push({ rule: rule.id, title: rule.title, weight, message: rule.message(features) });
    }
  }
  score = Math.min(100, score);
  return { score, level: levelOf(score), flagged: score >= FLAG_THRESHOLD, reasons };
}
