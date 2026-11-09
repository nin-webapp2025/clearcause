// Turns a snapshot into risk results: features -> rules -> optional ML -> combined.
import { extractAll } from "./features.js";
import { evaluateRules } from "./rules.js";
import { combine } from "./risk.js";

/** Ask the Python model service for anomaly scores. Returns null if it is not reachable. */
export async function scoreWithMl(mlUrl, featureRows, fetchImpl = fetch) {
  if (!mlUrl) return null;
  try {
    const res = await fetchImpl(`${mlUrl.replace(/\/$/, "")}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows: featureRows }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return Array.isArray(payload.scores) && payload.scores.length === featureRows.length ? payload : null;
  } catch {
    return null; // the rule engine keeps working without the model
  }
}

// Campaigns that can still be acted on. Rejected/Failed/Paid/Suspended are history.
const ACTIONABLE = new Set(["Pending", "Active", "Successful"]);

export async function scan(snapshot, { mlUrl, fetchImpl } = {}) {
  const extracted = extractAll(snapshot.campaigns);
  const mlResponse = await scoreWithMl(
    mlUrl,
    extracted.map((e) => e.features),
    fetchImpl,
  );
  const results = snapshot.campaigns.map((c, i) => {
    const { features } = extracted[i];
    const risk = combine(evaluateRules(features), mlResponse ? mlResponse.scores[i] : null);
    const actionable = ACTIONABLE.has(c.status);
    return {
      campaignId: c.id,
      title: c.title,
      owner: c.owner,
      payout: c.payout,
      status: c.status,
      donations: c.donations.length,
      ...risk,
      recommendation: risk.flagged && actionable ? (c.status === "Pending" ? "review_before_approval" : "consider_suspension") : "none",
      features,
    };
  });
  results.sort((a, b) => b.score - a.score);
  return {
    scannedAt: new Date().toISOString(),
    block: snapshot.block ?? null,
    mlAvailable: !!mlResponse,
    detector: {
      rulesVersion: "1",
      modelVersion: mlResponse?.modelVersion ?? null,
      sklearnVersion: mlResponse?.sklearnVersion ?? null,
    },
    total: results.length,
    flagged: results.filter((r) => r.flagged).length,
    results,
  };
}
