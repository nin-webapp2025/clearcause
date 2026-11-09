# Fraud-detection layer

Watches the ClearCause contract, scores every campaign for fraud risk, and shows the admin *why* in the
Campaign Review screen. **It only advises.** The service holds no private key and cannot change anything
on-chain: the admin decides, and the existing `approveCampaign` / `rejectCampaign` / `suspendCampaign`
functions carry out the decision. This human-in-the-loop design is deliberate (a false alarm must not freeze
a real charity's money automatically, and a hot admin key on a server would be a bigger risk than the fraud).

```
ClearCause contract ──events──► service/chain.js ──snapshot──► features.js ──► rules.js ─┐
                                                              │                      ├─► risk.js ─► REST API ─► admin screen
                                                              └─► ml/serve.py (Isolation Forest) ┘
```

| Part | Where | What it does |
|---|---|---|
| Features | `service/src/features.js` | 17 per-campaign features (donor concentration, burstiness, timing regularity, self-funding, shared payout wallets, serial creation, ...) |
| Rules | `service/src/rules.js` | 9 explainable rules with fixed weights; score 0-100, flag at 40 |
| Anomaly model | `ml/train.py`, `ml/serve.py` | Isolation Forest trained on normal campaigns only; Flask scoring API |
| Combination | `service/src/risk.js` | flagged if rules flag **or** the model calls it an anomaly; score = max of both |
| API | `service/src/server.js` | `GET /health`, `GET /api/risk[?flagged=1]`, `GET /api/risk/history`, `GET /api/risk/:id`, authenticated `POST /api/rescan` |
| Audit storage | `service/src/fraud-store.js` | Persists the latest full report and bounded scan history locally or in PostgreSQL |
| Admin UI | `client/src/components/Admin/CampaignReview.jsx` | risk panel with reasons, "Flagged" filter, one-click reuse of the findings as the on-chain suspension reason. Works without the service. |
| Demo | `service/scripts/integration-demo.mjs` | seeds honest + fraudulent campaigns on a local chain, scans, then acts as admin |

## Run it

```bash
# 1. data + model (about 1 minute)
cd fraud/ml && pip install -r requirements.txt
python generate_data.py --out data --seed 42
python train.py --data data --out model          # prints the evaluation, writes model/metrics.json and roc.png
python serve.py --model model --port 5001        # leave running (optional: the service falls back to rules only)

# 2. service
cd ../service && npm install && npm test         # 17 unit tests
ML_URL=http://127.0.0.1:5001 npm start           # http://localhost:4000
# npm run test:all runs both the Node service tests and the Python model API tests

# 3. full demo (needs `npx hardhat node` + `npm run deploy:local` in contract/)
ML_URL=http://127.0.0.1:5001 node scripts/integration-demo.mjs

# 4. UI: set VITE_FRAUD_API_URL=http://localhost:4000 in client/.env
```

## Evaluation (synthetic data, seed 42, regenerable and deterministic)

Splits use separate seeds and never share wallets: `train` (model fitting, normals only), `validation` (the
ML alert threshold was chosen here and nowhere else), `test_standard` and `test_hard` (never used for any choice).
`test_hard` has subtle fraud and twice as many unusual-but-legitimate normal campaigns (viral bursts, whale donors,
pledge drives, charities launching several campaigns in one appeal week). About 20% of campaigns are fraud.

| Test set | System | Precision | Recall | F1 | False-positive rate | AUC |
|---|---|---|---|---|---|---|
| standard | rules | 0.65 | 0.55 | 0.59 | 0.075 | 0.86 |
| standard | anomaly model | 0.76 | 0.70 | 0.73 | 0.056 | 0.90 |
| standard | **combined** | 0.69 | **0.995** | **0.82** | 0.111 | **0.95** |
| hard | rules | 0.27 | 0.17 | 0.21 | 0.116 | 0.79 |
| hard | anomaly model | 0.60 | 0.64 | 0.62 | 0.109 | 0.82 |
| hard | **combined** | 0.50 | **0.73** | 0.59 | 0.189 | **0.87** |

What the numbers say (and do not say):
- The two methods are **complementary**. Rules catch self-funding, bot bursts, structuring and payout rings (recall 1.0
  on standard fraud) but almost never catch serial campaign spam on their own; the model catches serial spam (0.99)
  but misses self-funding and rings. Neither alone reaches the combined recall.
- Combining raises recall at the price of more false alarms. For an admin queue that is the right trade (a false alarm
  costs a glance, a missed fraud costs donors' money), but it is a choice, and the table shows both sides.
- On `test_hard` performance drops clearly (F1 0.59, 19% false alarms). Subtle fraud and legitimate look-alikes
  overlap, which is the real difficulty of the problem.
- **The main false-positive source is real charities running several campaigns that pay one wallet.** Every rule
  false positive on validation involved a shared payout wallet, most of them campaigns launched in the same week.
  Structurally this is the same as a fraud ring.
  Mitigations that fit this design: an admin allow-list of verified charity payout wallets, and KYC history.

## Limitations to state in the report
1. **Synthetic data.** No public labelled dataset of on-chain charity fraud exists. The fraud typologies were
   modelled from published fraud patterns by the author, so the detectors are partly tested on the author's own assumptions.
   Splits, fixed seeds, a hard test set and frozen thresholds limit but do not remove this circularity. The right claim is
   "detects these modelled patterns", not "catches real-world fraud".
2. **Iteration disclosure.** The first run (`docs/iteration1_metrics.json`) exposed two flaws that were then fixed:
   the generator made fraud rings indistinguishable from charity groups (a `payout_burst` feature and `PAYOUT_RING` rule were
   added, and the generator was made realistic), and the training data contained no unusual-but-legitimate campaigns
   (so the model flagged them all). Both fixes were made after seeing results, so the test numbers are not a one-shot,
   untouched estimate. Report both runs.
3. Rule weights were set from the typologies and not tuned on test data (the `PAYOUT_RING` rule was added after the first run, see 2); the ML threshold was chosen on validation only.
4. Wallet-level evidence only. Fraud that looks like ordinary activity (a creator who simply lies about the cause) is
   invisible to this layer; that is what admin review and milestone governance are for.
5. Live demo uses 10 hand-built campaigns, i.e. a functional check of the pipeline, not a performance measurement.
   Honest demo campaigns scored 39/100, just below the flag line (the model's score on tiny, slow campaigns is borderline).
