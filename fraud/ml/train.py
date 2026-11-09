"""Train the anomaly model and evaluate rules vs ML vs combined.

Pipeline
  1. Features and rule scores come from the Node service (same code the live service runs).
  2. Isolation Forest is fitted on the TRAIN split, normal campaigns only (in a real system these are the
     campaigns the admin approved and that were never suspended).
  3. The alert threshold is chosen on the VALIDATION split only (best F1) and then frozen.
  4. Rules, ML and the combined system are scored on TEST_STANDARD and TEST_HARD, which were never used
     for any choice. Rule weights/thresholds were fixed in advance from fraud typologies (see rules.js).

Usage: python train.py --data data --out model
"""
import argparse
import json
import os
import subprocess
import sys

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (average_precision_score, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score, roc_curve)
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

HERE = os.path.dirname(os.path.abspath(__file__))
CLI = os.path.join(HERE, "..", "service", "src", "cli.js")
SPLITS = ["train", "validation", "test_standard", "test_hard"]
SEED = 0


def featurize(data_dir, split, cache_dir):
    src = os.path.join(data_dir, f"{split}.json")
    dst = os.path.join(cache_dir, f"{split}.features.json")
    subprocess.run(["node", CLI, "features", src, dst], check=True)
    d = json.load(open(dst))
    names = d["featureNames"]
    X = np.array([[r["features"][n] for n in names] for r in d["rows"]], dtype=float)
    y = np.array([r["label"] for r in d["rows"]], dtype=int)
    rule_score = np.array([r["ruleScore"] for r in d["rows"]], dtype=float)
    rule_flag = np.array([r["ruleFlagged"] for r in d["rows"]], dtype=bool)
    types = np.array([r["fraudType"] for r in d["rows"]])
    return dict(X=X, y=y, rule_score=rule_score, rule_flag=rule_flag, types=types, names=names)


def build_model():
    return make_pipeline(
        FunctionTransformer(np.log1p, feature_names_out="one-to-one"),
        StandardScaler(),
        IsolationForest(n_estimators=300, max_samples=256, random_state=SEED),
    )


def raw_anomaly(model, X):
    return -model.score_samples(X)  # higher = more anomalous


def best_f1_threshold(y, score):
    best_t, best_f = None, -1
    for t in np.unique(np.round(score, 4)):
        f = f1_score(y, score >= t, zero_division=0)
        if f > best_f:
            best_t, best_f = float(t), f
    return best_t, best_f


def metrics(y, flag, score):
    tn, fp, fn, tp = confusion_matrix(y, flag, labels=[0, 1]).ravel()
    return {
        "precision": round(float(precision_score(y, flag, zero_division=0)), 4),
        "recall": round(float(recall_score(y, flag, zero_division=0)), 4),
        "f1": round(float(f1_score(y, flag, zero_division=0)), 4),
        "false_positive_rate": round(float(fp / max(1, fp + tn)), 4),
        "auc_roc": round(float(roc_auc_score(y, score)), 4),
        "avg_precision": round(float(average_precision_score(y, score)), 4),
        "tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="model")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    cache = os.path.join(a.data, "_features")
    os.makedirs(cache, exist_ok=True)

    D = {s: featurize(a.data, s, cache) for s in SPLITS}
    names = D["train"]["names"]

    tr = D["train"]
    model = build_model().fit(tr["X"][tr["y"] == 0])

    # normalise the raw score to 0..1 using the NORMAL training campaigns only
    raw_tr = raw_anomaly(model, tr["X"][tr["y"] == 0])
    lo, hi = float(np.percentile(raw_tr, 50)), float(np.percentile(raw_tr, 99.5))
    norm = lambda raw: np.clip((raw - lo) / (hi - lo + 1e-12), 0, 1)

    val = D["validation"]
    ml_val = norm(raw_anomaly(model, val["X"]))
    thr, val_f1 = best_f1_threshold(val["y"], ml_val)
    print(f"ML alert threshold (chosen on validation only): {thr:.3f}  (validation F1 {val_f1:.3f})")

    results = {"threshold": thr, "validation_f1_ml": round(val_f1, 4), "splits": {}}
    curves = {}
    for s in SPLITS[1:]:
        d = D[s]
        ml_score = norm(raw_anomaly(model, d["X"]))
        ml_flag = ml_score >= thr
        rule_flag = d["rule_flag"]
        comb_flag = rule_flag | ml_flag
        comb_score = np.maximum(d["rule_score"] / 100.0, ml_score)
        res = {
            "n": int(len(d["y"])), "n_fraud": int(d["y"].sum()),
            "rules": metrics(d["y"], rule_flag, d["rule_score"]),
            "ml": metrics(d["y"], ml_flag, ml_score),
            "combined": metrics(d["y"], comb_flag, comb_score),
            "recall_by_type": {},
        }
        for t in sorted(set(d["types"]) - {"none"}):
            m = d["types"] == t
            res["recall_by_type"][t] = {
                "n": int(m.sum()),
                "rules": round(float(rule_flag[m].mean()), 3),
                "ml": round(float(ml_flag[m].mean()), 3),
                "combined": round(float(comb_flag[m].mean()), 3),
            }
        results["splits"][s] = res
        curves[s] = {k: roc_curve(d["y"], v) for k, v in
                     [("rules", d["rule_score"]), ("ml", ml_score), ("combined", comb_score)]}

    # which features drive the anomaly score (permutation: how much the ranking changes)
    rng = np.random.default_rng(SEED)
    d = D["test_standard"]
    base = roc_auc_score(d["y"], raw_anomaly(model, d["X"]))
    imp = {}
    for j, n in enumerate(names):
        drops = []
        for _ in range(5):
            Xp = d["X"].copy()
            Xp[:, j] = rng.permutation(Xp[:, j])
            drops.append(base - roc_auc_score(d["y"], raw_anomaly(model, Xp)))
        imp[n] = round(float(np.mean(drops)), 4)
    results["feature_importance_auc_drop"] = dict(sorted(imp.items(), key=lambda kv: -kv[1]))

    joblib.dump(model, os.path.join(a.out, "isolation_forest.joblib"))
    meta = {"feature_names": names, "raw_lo": lo, "raw_hi": hi, "threshold": thr,
            "sklearn": __import__("sklearn").__version__}
    json.dump(meta, open(os.path.join(a.out, "model_meta.json"), "w"), indent=2)
    json.dump(results, open(os.path.join(a.out, "metrics.json"), "w"), indent=2)

    # console summary
    for s, r in results["splits"].items():
        print(f"\n== {s}  (n={r['n']}, fraud={r['n_fraud']})")
        print(f"{'system':10s} {'prec':>6s} {'recall':>7s} {'F1':>6s} {'FPR':>6s} {'AUC':>6s}")
        for k in ("rules", "ml", "combined"):
            m = r[k]
            print(f"{k:10s} {m['precision']:6.3f} {m['recall']:7.3f} {m['f1']:6.3f} {m['false_positive_rate']:6.3f} {m['auc_roc']:6.3f}")
        for t, v in r["recall_by_type"].items():
            print(f"   recall {t:18s} n={v['n']:3d} rules={v['rules']:.2f} ml={v['ml']:.2f} combined={v['combined']:.2f}")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, axes = plt.subplots(1, 2, figsize=(10, 4.2))
        for ax, s in zip(axes, ["test_standard", "test_hard"]):
            for k, (fpr, tpr, _) in curves[s].items():
                ax.plot(fpr, tpr, label=f"{k} (AUC {results['splits'][s][k]['auc_roc']:.2f})")
            ax.plot([0, 1], [0, 1], "k:", lw=0.8)
            ax.set_title(s.replace("_", " ")); ax.set_xlabel("False positive rate"); ax.set_ylabel("True positive rate")
            ax.legend(loc="lower right")
        fig.tight_layout(); fig.savefig(os.path.join(a.out, "roc.png"), dpi=150)
    except Exception as e:  # plotting is optional
        print("plot skipped:", e, file=sys.stderr)


if __name__ == "__main__":
    main()
