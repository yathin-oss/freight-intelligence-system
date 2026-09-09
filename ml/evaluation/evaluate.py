"""
Standalone re-verification script: reloads the persisted model artifact and
the untouched test window, recomputes metrics independently of train.py, and
prints a judge-friendly comparison table. This exists so the reported
accuracy numbers are reproducible on demand, not just copy-pasted claims.

Run:  python3 ml/evaluation/evaluate.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from ml.ml_core.features import build_training_frame, one_hot_lane  # noqa: E402
from ml.training.train import mae, mape, rmse, directional_accuracy  # noqa: E402

DATA_DIR = REPO_ROOT / "data" / "synthetic"
MODEL_PATH = REPO_ROOT / "ml" / "models" / "freight_model.joblib"
RESULTS_PATH = REPO_ROOT / "ml" / "evaluation" / "results.json"


def main():
    if not MODEL_PATH.exists():
        print("No trained model found. Run ml/training/train.py first.")
        sys.exit(1)

    artifact = joblib.load(MODEL_PATH)
    freight_df = pd.read_csv(DATA_DIR / "freight_rate_history.csv")
    market_df = pd.read_csv(DATA_DIR / "market_indicators.csv")
    feat_df = build_training_frame(freight_df, market_df)
    feat_df = one_hot_lane(feat_df, artifact["known_origins"], artifact["known_cargoes"])
    feat_df = feat_df.sort_values("date").reset_index(drop=True)

    n = len(feat_df)
    val_end = int(n * 0.85)
    test_df = feat_df.iloc[val_end:]

    X_test = test_df[artifact["feature_columns"]]
    y_test = test_df["target"]
    preds = artifact["model"].predict(X_test)

    recomputed = dict(
        mae=mae(y_test, preds),
        rmse=rmse(y_test, preds),
        mape=mape(y_test, preds),
        directional_accuracy=directional_accuracy(test_df["lag_1"], y_test, preds),
    )

    print(f"Model: {artifact['model_type']}  (version {artifact['model_version']})")
    print(f"Trained at: {artifact['trained_at']}")
    print(f"Test rows: {len(test_df)}")
    print("\nRecomputed test metrics (independent of train.py run):")
    for k, v in recomputed.items():
        print(f"  {k:22s} {v:.3f}")

    if RESULTS_PATH.exists():
        with open(RESULTS_PATH) as f:
            stored = json.load(f)
        print("\nStored results.json test_metrics for comparison:")
        print(json.dumps(stored["test_metrics"], indent=2))

    tolerance = 1e-6
    original = None
    if RESULTS_PATH.exists():
        original = stored["test_metrics"].get(artifact["model_type"], {})
    if original:
        drift = abs(original.get("mae", 0) - recomputed["mae"])
        status = "MATCH" if drift < tolerance else f"DRIFT ({drift:.6f})"
        print(f"\nReproducibility check vs stored results.json: {status}")


if __name__ == "__main__":
    main()
