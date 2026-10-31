from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    recall_score,
    roc_auc_score,
)

try:
    from backend.ml.preprocess import FEATURE_COLUMNS, prepare
except ImportError:  # pragma: no cover
    from ml.preprocess import FEATURE_COLUMNS, prepare

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "historical_projects.csv"
MODELS_DIR = ROOT / "models"
TARGET = "is_delayed"


def load_data():
    df = pd.read_csv(DATA_PATH).sort_values("planned_start").reset_index(drop=True)
    n_total = len(df)
    train_end = int(n_total * 0.7)
    val_end = int(n_total * 0.85)
    return df.iloc[:train_end].copy(), df.iloc[train_end:val_end].copy(), df.iloc[val_end:].copy()


def top10_recall(y_true: pd.Series, scores: np.ndarray) -> float:
    n_top = max(1, int(np.ceil(len(y_true) * 0.1)))
    top_idx = np.argsort(scores)[::-1][:n_top]
    return float(y_true.iloc[top_idx].mean()) if len(top_idx) else 0.0


def compute_metrics(model, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    probs = model.predict_proba(X_test)[:, 1]
    preds = (probs >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, preds).ravel()
    return {
        "pr_auc": float(average_precision_score(y_test, probs)),
        "roc_auc": float(roc_auc_score(y_test, probs)),
        "recall": float(recall_score(y_test, preds, zero_division=0)),
        "f1": float(f1_score(y_test, preds, zero_division=0)),
        "brier": float(brier_score_loss(y_test, probs)),
        "top10_recall": float(top10_recall(y_test, probs)),
        "confusion_matrix": [int(tn), int(fp), int(fn), int(tp)],
    }


def main():
    _, _, test_df = load_data()
    X_test = prepare(test_df[FEATURE_COLUMNS].copy())
    y_test = test_df[TARGET].astype(int)

    baseline = joblib.load(MODELS_DIR / "baseline.joblib")
    xgb = joblib.load(MODELS_DIR / "xgb_raw.joblib")

    metrics = {
        "baseline": compute_metrics(baseline, X_test, y_test),
        "xgb_raw": compute_metrics(xgb, X_test, y_test),
    }

    with open(MODELS_DIR / "metrics.json", "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)

    print("Model comparison")
    for name, value in metrics.items():
        print(f"{name}: {json.dumps(value, sort_keys=True)}")


if __name__ == "__main__":
    main()
