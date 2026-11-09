import test from "node:test";
import assert from "node:assert/strict";
import { extractAll, FEATURE_NAMES } from "../src/features.js";
import { evaluateRules } from "../src/rules.js";
import { combine } from "../src/risk.js";

const A = (n) => "0x" + String(n).padStart(40, "0");
const T0 = 1_700_000_000;
const HOUR = 3600;

function campaign(over = {}) {
  return {
    id: 1,
    owner: A(1),
    payout: A(1),
    target: 10,
    createdAt: T0,
    approvedAt: T0,
    donations: [],
    ...over,
  };
}

// human-like donations: different donors, varied amounts, irregular gaps over days
function organicDonations(n = 20) {
  const gaps = [3, 50, 7, 90, 20, 400, 11, 1500, 35, 600, 5, 2000, 80, 300, 15, 900, 40, 120, 700, 25];
  const amounts = [0.05, 0.2, 0.01, 0.5, 0.12, 0.3, 0.07, 0.9, 0.02, 0.15, 0.33, 0.04, 0.6, 0.08, 0.25, 0.11, 0.45, 0.06, 0.18, 0.7];
  let ts = T0 + 2 * HOUR;
  return Array.from({ length: n }, (_, i) => {
    ts += gaps[i % gaps.length] * 60;
    return { donor: A(100 + i), amount: amounts[i % amounts.length], ts };
  });
}

const feats = (c, others = []) => extractAll([c, ...others])[0].features;

test("every declared feature is produced", () => {
  const f = feats(campaign({ donations: organicDonations() }));
  for (const name of FEATURE_NAMES) assert.ok(name in f, `missing ${name}`);
  assert.equal(Object.keys(f).length, FEATURE_NAMES.length);
});

test("empty campaign gives zeros without NaN", () => {
  const f = feats(campaign());
  for (const v of Object.values(f)) assert.ok(Number.isFinite(v));
  assert.equal(evaluateRules(f).flagged, false);
});

test("organic campaign is not flagged", () => {
  const f = feats(campaign({ donations: organicDonations() }));
  const r = evaluateRules(f);
  assert.equal(r.flagged, false, JSON.stringify(r.reasons));
  assert.equal(r.level, "low");
});

test("self donation is detected", () => {
  const don = organicDonations(10);
  don.push({ donor: A(1), amount: 3, ts: T0 + 3 * HOUR }); // creator pays into own campaign
  const f = feats(campaign({ donations: don }));
  assert.ok(f.self_donation_share > 0.5);
  const r = evaluateRules(f);
  assert.ok(r.reasons.some((x) => x.rule === "SELF_DONATION"));
  assert.equal(r.flagged, true);
});

test("payout wallet donating counts as self donation", () => {
  const c = campaign({ payout: A(9), donations: [...organicDonations(8), { donor: A(9), amount: 2, ts: T0 + 5 * HOUR }] });
  assert.ok(feats(c).self_donation_share > 0.3);
});

test("shared payout across creators", () => {
  const a = campaign({ id: 1, owner: A(1), payout: A(50), donations: organicDonations(5) });
  const b = campaign({ id: 2, owner: A(2), payout: A(50), createdAt: T0 + 30 * 86400, approvedAt: T0 + 30 * 86400 });
  const r = extractAll([a, b]);
  assert.equal(r[0].features.payout_shared_owners, 2);
  assert.ok(evaluateRules(r[0].features).reasons.some((x) => x.rule === "SHARED_PAYOUT"));
});

test("same creator using their own separate payout wallet is not a shared payout", () => {
  const a = campaign({ id: 1, owner: A(1), payout: A(50) });
  const b = campaign({ id: 2, owner: A(1), payout: A(50), createdAt: T0 + 30 * 86400 });
  assert.equal(extractAll([a, b])[0].features.payout_shared_owners, 1);
});

test("serial campaign creation", () => {
  const cs = [1, 2, 3, 4].map((i) =>
    campaign({ id: i, owner: A(7), payout: A(7), createdAt: T0 + i * 600, approvedAt: T0 + i * 600 }),
  );
  const f = extractAll(cs)[0].features;
  assert.equal(f.owner_burst, 4);
  assert.ok(evaluateRules(f).reasons.some((x) => x.rule === "SERIAL_CAMPAIGNS"));
});

test("burst of donations within ten minutes", () => {
  const don = Array.from({ length: 12 }, (_, i) => ({ donor: A(200 + i), amount: 0.1 + i * 0.013, ts: T0 + 600 + i * 20 }));
  const f = feats(campaign({ donations: don }));
  assert.equal(f.max_burst, 12);
  assert.ok(f.first_hour_share > 0.9);
});

test("scripted donations: identical amounts at regular intervals", () => {
  const don = Array.from({ length: 12 }, (_, i) => ({ donor: A(300 + i), amount: 0.5, ts: T0 + HOUR + i * 1800 }));
  const f = feats(campaign({ donations: don }));
  assert.equal(f.top_amount_repeat_share, 1);
  assert.ok(f.interval_cv < 0.01);
  const ids = evaluateRules(f).reasons.map((r) => r.rule);
  assert.ok(ids.includes("IDENTICAL_AMOUNTS") && ids.includes("REGULAR_INTERVALS"));
});

test("a single large donor alone does not flag (innocent explanation)", () => {
  const c = campaign({ donations: [{ donor: A(400), amount: 8, ts: T0 + 5 * HOUR }, ...organicDonations(3)] });
  const r = evaluateRules(feats(c));
  assert.equal(r.flagged, false, JSON.stringify(r.reasons));
});

test("charity payout wallet alone does not flag", () => {
  const c = campaign({ payout: A(60), donations: organicDonations() });
  const r = evaluateRules(feats(c));
  assert.equal(r.flagged, false);
});

test("score is capped at 100", () => {
  const don = Array.from({ length: 12 }, (_, i) => ({ donor: A(1), amount: 0.5, ts: T0 + i * 10 }));
  const r = evaluateRules(feats(campaign({ donations: don })));
  assert.ok(r.score <= 100);
  assert.equal(r.level, "high");
});

test("combine: rules only when no model", () => {
  const r = combine(evaluateRules(feats(campaign({ donations: organicDonations() }))), null);
  assert.equal(r.source, "rules");
  assert.equal(r.ml, null);
});

test("combine: model anomaly alone flags the campaign", () => {
  const rules = evaluateRules(feats(campaign({ donations: organicDonations() })));
  const r = combine(rules, { score: 0.8, isAnomaly: true });
  assert.equal(r.flagged, true);
  assert.equal(r.score, 80);
  assert.ok(r.reasons.some((x) => x.rule === "ML_ANOMALY"));
});

test("combine: low model score and clean rules stays unflagged", () => {
  const rules = evaluateRules(feats(campaign({ donations: organicDonations() })));
  const r = combine(rules, { score: 0.2, isAnomaly: false });
  assert.equal(r.flagged, false);
  assert.equal(r.level, "low");
});

test("donor addresses are compared case-insensitively", () => {
  const owner = "0xAbCdEf0000000000000000000000000000000001";
  const c = campaign({ owner, payout: owner.toLowerCase(), donations: [{ donor: owner.toUpperCase().replace("0X", "0x"), amount: 1, ts: T0 + HOUR }] });
  assert.equal(feats(c).self_donation_share, 1);
  assert.equal(feats(c).payout_differs, 0);
});
