// Combines the rule result with the (optional) machine learning result.
//
//   flagged = rules flagged OR the model calls it an anomaly
//   score   = the higher of the rule score and the model score (0-100)
//
// The Python evaluation (ml/train.py) uses exactly the same combination, so the
// numbers in the report describe what this service does.

import { FLAG_THRESHOLD, HIGH_THRESHOLD, levelOf } from "./rules.js";

export function combine(ruleResult, ml) {
  if (!ml) {
    return { ...ruleResult, ml: null, source: "rules" };
  }
  // Put the model on the same 0-100 scale as the rules so that "score >= FLAG_THRESHOLD"
  // always means "flagged": an anomaly is at least FLAG_THRESHOLD, a non-anomaly stays below it.
  const raw = Math.round(ml.score * 100);
  const mlScore = ml.isAnomaly ? Math.max(raw, FLAG_THRESHOLD) : Math.min(raw, FLAG_THRESHOLD - 1);
  const score = Math.max(ruleResult.score, mlScore);
  const reasons = [...ruleResult.reasons];
  if (ml.isAnomaly) {
    reasons.push({
      rule: "ML_ANOMALY",
      title: "Unusual compared with normal campaigns",
      weight: mlScore,
      message: `The anomaly model rates this campaign ${raw}/100 (alert threshold is learned from past campaigns)`,
    });
  }
  return {
    score,
    level: levelOf(score),
    flagged: score >= FLAG_THRESHOLD,
    reasons,
    ml: { score: mlScore, isAnomaly: ml.isAnomaly },
    source: "rules+ml",
  };
}

export { FLAG_THRESHOLD, HIGH_THRESHOLD };
