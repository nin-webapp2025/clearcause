"""Scoring API for the trained anomaly model.

  POST /score   {"rows": [{<feature name>: number, ...}, ...]}  ->  {"scores": [{"score": 0..1, "isAnomaly": bool}, ...]}
  GET  /health

Run:  python serve.py --model model --port 5001
"""
import argparse
import hashlib
import json
import os

import joblib
import numpy as np
from flask import Flask, jsonify, request


def create_app(model_dir):
    model_path = os.path.join(model_dir, "isolation_forest.joblib")
    model = joblib.load(model_path)
    with open(os.path.join(model_dir, "model_meta.json"), encoding="utf-8") as meta_file:
        meta = json.load(meta_file)
    names, lo, hi, thr = meta["feature_names"], meta["raw_lo"], meta["raw_hi"], meta["threshold"]
    with open(model_path, "rb") as model_file:
        model_version = f"isolation-forest:{hashlib.sha256(model_file.read()).hexdigest()[:12]}"
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_REQUEST_BYTES", "262144"))

    @app.get("/health")
    def health():
        return jsonify(ok=True, features=len(names), threshold=thr, modelVersion=model_version,
                       sklearnVersion=meta.get("sklearn"))

    @app.post("/score")
    def score():
        rows = (request.get_json(silent=True) or {}).get("rows")
        if not isinstance(rows, list):
            return jsonify(error="body must be {'rows': [...]}"), 400
        max_rows = int(os.environ.get("MAX_SCORE_ROWS", "500"))
        if len(rows) > max_rows:
            return jsonify(error=f"at most {max_rows} rows may be scored at once"), 413
        try:
            X = np.array([[float(r[n]) for n in names] for r in rows], dtype=float).reshape(len(rows), len(names))
        except (KeyError, TypeError, ValueError) as e:
            return jsonify(error=f"bad feature row: {e}"), 400
        if len(rows) == 0:
            return jsonify(scores=[])
        raw = -model.score_samples(X)
        s = np.clip((raw - lo) / (hi - lo + 1e-12), 0, 1)
        return jsonify(
            scores=[{"score": round(float(v), 4), "isAnomaly": bool(v >= thr)} for v in s],
            modelVersion=model_version,
            sklearnVersion=meta.get("sklearn"),
        )

    return app


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="model")
    ap.add_argument("--port", type=int, default=5001)
    a = ap.parse_args()
    create_app(a.model).run(host=os.environ.get("HOST", "127.0.0.1"), port=a.port)
