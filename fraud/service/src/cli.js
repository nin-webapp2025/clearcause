// Usage: node src/cli.js features <snapshot.json> [out.json]
// Reads a snapshot ({campaigns:[...]}), writes per-campaign features and rule results.
// Used by ml/train.py so the model is trained on exactly the features the live service computes.
import fs from "node:fs";
import { extractAll, FEATURE_NAMES } from "./features.js";
import { evaluateRules } from "./rules.js";

const [cmd, input, output] = process.argv.slice(2);
if (cmd !== "features" || !input) {
  console.error("usage: node src/cli.js features <snapshot.json> [out.json]");
  process.exit(2);
}
const snap = JSON.parse(fs.readFileSync(input, "utf8"));
const campaigns = snap.campaigns ?? snap;
const rows = extractAll(campaigns).map(({ id, features }, i) => {
  const rules = evaluateRules(features);
  return {
    id,
    label: campaigns[i].label ?? null,
    fraudType: campaigns[i].fraudType ?? null,
    features,
    ruleScore: rules.score,
    ruleFlagged: rules.flagged,
    ruleIds: rules.reasons.map((r) => r.rule),
  };
});
const out = JSON.stringify({ featureNames: FEATURE_NAMES, rows });
if (output) fs.writeFileSync(output, out);
else process.stdout.write(out);
