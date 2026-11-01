from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier, XGBRegressor

try:
    from backend.ml.preprocess import CURRENT_STAGE_ORDER, FEATURE_COLUMNS, PROJECT_TYPE_ORDER, prepare
except ImportError:  # pragma: no cover
    from ml.preprocess import CURRENT_STAGE_ORDER, FEATURE_COLUMNS, PROJECT_TYPE_ORDER, prepare

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "historical_projects.csv"
MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
ACTIVE_VERSION_PATH = Path(__file__).resolve().parents[2] / "models" / "ACTIVE_VERSION"
VERSION_DIR = MODELS_DIR / "v1"
VERSION_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
TARGET = "is_delayed"


def load_historical_data(path: str | Path = DATA_PATH) -> pd.DataFrame:
    df = pd.read_csv(path)
    return df.sort_values("planned_start").reset_index(drop=True)


def time_split(df: pd.DataFrame, train_frac: float = 0.7, val_frac: float = 0.15):
    n_total = len(df)
    train_end = int(n_total * train_frac)
    val_end = int(n_total * (train_frac + val_frac))
    return df.iloc[:train_end].copy(), df.iloc[train_end:val_end].copy(), df.iloc[val_end:].copy()


def make_features_target(df: pd.DataFrame, target: str = TARGET):
    features = prepare(df[FEATURE_COLUMNS].copy())
    return features, df[target].astype(int)


def fit_baseline(X_train: pd.DataFrame, y_train: pd.Series) -> Pipeline:
    pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ]
    )
    pipe.fit(X_train, y_train)
    return pipe


def fit_xgb_binary(X_train: pd.DataFrame, y_train: pd.Series, X_val: pd.DataFrame | None = None, y_val: pd.Series | None = None, seed: int = 42, early_stop: bool = True):
    pos_rate = float(y_train.mean())
    model = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=(1.0 - pos_rate) / max(pos_rate, 1e-6),
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=seed,
        n_jobs=1,
        early_stopping_rounds=20 if early_stop and X_val is not None and y_val is not None else None,
    )
    if X_val is not None and y_val is not None and early_stop:
        model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    else:
        model.fit(X_train, y_train)
    return model


def compute_top10_recall(y_true: pd.Series, scores: np.ndarray) -> float:
    if len(y_true) == 0:
        return 0.0
    n_top = max(1, int(np.ceil(len(y_true) * 0.1)))
    top_idx = np.argsort(scores)[::-1][:n_top]
    return float(y_true.iloc[top_idx].mean()) if len(top_idx) else 0.0


def evaluate_binary(model: Any, X_test: pd.DataFrame, y_test: pd.Series):
    prob = model.predict_proba(X_test)[:, 1]
    pred = (prob >= 0.5).astype(int)
    pr_auc = average_precision_score(y_test, prob)
    roc_auc = roc_auc_score(y_test, prob)
    recall = recall_score(y_test, pred, zero_division=0)
    f1 = f1_score(y_test, pred, zero_division=0)
    brier = brier_score_loss(y_test, prob)
    tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
    top10 = compute_top10_recall(y_test, prob)
    return {
        "pr_auc": float(pr_auc),
        "roc_auc": float(roc_auc),
        "recall": float(recall),
        "f1": float(f1),
        "brier": float(brier),
        "top10_recall": float(top10),
        "confusion_matrix": [int(tn), int(fp), int(fn), int(tp)],
    }


def reliability_table(pred_probs: np.ndarray, y_true: pd.Series, bins: int = 10):
    edges = np.linspace(0, 1, bins + 1)
    rows = []
    for i in range(bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (pred_probs >= lo) & (pred_probs < hi if i < bins - 1 else pred_probs <= hi)
        selected_probs = pred_probs[mask]
        selected_true = y_true.iloc[mask]
        if len(selected_probs) == 0:
            mean_pred = 0.0
            mean_actual = 0.0
            count = 0
        else:
            mean_pred = float(np.mean(selected_probs))
            mean_actual = float(np.mean(selected_true))
            count = int(len(selected_true))
        rows.append({
            "bin": i,
            "low": round(float(lo), 4),
            "high": round(float(hi), 4),
            "mean_predicted": round(mean_pred, 4),
            "mean_actual": round(mean_actual, 4),
            "count": count,
        })
    return rows


def fit_regressor(X_train: pd.DataFrame, y_train: pd.Series, X_val: pd.DataFrame, y_val: pd.Series):
    model = XGBRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=1,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    return model


def train_stage_model(X_train: pd.DataFrame, y_train: pd.Series, X_val: pd.DataFrame, y_val: pd.Series):
    model = XGBClassifier(
        n_estimators=250,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=1,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    return model


def fit_calibrated_xgb(X_train: pd.DataFrame, y_train: pd.Series, X_val: pd.DataFrame, y_val: pd.Series):
    method = "isotonic" if len(X_val) > 1000 else "sigmoid"
    raw = fit_xgb_binary(X_train, y_train, X_val, y_val, early_stop=True)
    calibration_model = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=(1.0 - float(y_train.mean())) / max(float(y_train.mean()), 1e-6),
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=1,
    )
    calibration_model.fit(X_train, y_train)
    calibrator = CalibratedClassifierCV(estimator=calibration_model, method=method, cv=3)
    calibrator.fit(X_val, y_val)
    return raw, calibrator, method


def save_active_version(version: str):
    ACTIVE_VERSION_PATH.write_text(version, encoding="utf-8")


def save_metrics_json(path: Path, metrics: dict):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2)


def main():
    df = load_historical_data()
    train_df, val_df, test_df = time_split(df)

    X_train, y_train = make_features_target(train_df)
    X_val, y_val = make_features_target(val_df)
    X_test, y_test = make_features_target(test_df)

    # B4 baseline + raw model
    baseline = fit_baseline(X_train, y_train)
    xgb_raw = fit_xgb_binary(X_train, y_train, X_val, y_val)
    baseline_metrics = evaluate_binary(baseline, X_test, y_test)
    xgb_metrics = evaluate_binary(xgb_raw, X_test, y_test)

    # B5 calibration on validation split using raw model with cv="prefit".
    xgb_raw, calibrator, calibration_method = fit_calibrated_xgb(X_train, y_train, X_val, y_val)
    calibrated_probs = calibrator.predict_proba(X_test)[:, 1]
    calibrated_metrics = evaluate_binary(calibrator, X_test, y_test)
    brier_before = float(brier_score_loss(y_test, xgb_raw.predict_proba(X_test)[:, 1]))
    brier_after = float(brier_score_loss(y_test, calibrated_probs))

    # Delay-days regressor: use the regressor output directly for delayed projects and scale it by the
    # project-level delay probability when used in the prediction object. This keeps expected delay days
    # anchored to the observed duration distribution of delayed projects while still reflecting risk.
    delayed_rows = df[df[TARGET] == 1].copy()
    delay_train_df, delay_val_df, delay_test_df = time_split(delayed_rows)
    X_delay_train, y_delay_train = make_features_target(delay_train_df, target="delay_days")
    X_delay_val, y_delay_val = make_features_target(delay_val_df, target="delay_days")
    X_delay_test, y_delay_test = make_features_target(delay_test_df, target="delay_days")
    regressor = fit_regressor(X_delay_train, y_delay_train, X_delay_val, y_delay_val)
    pred_days = regressor.predict(X_delay_test)
    mae_days = float(mean_absolute_error(y_delay_test, pred_days))
    rmse_days = float(np.sqrt(mean_squared_error(y_delay_test, pred_days)))

    # Stage models: fit one small XGBClassifier per delayed stage using the same feature set.
    stage_approval = train_stage_model(X_train, train_df["delayed_approval"].astype(int), X_val, val_df["delayed_approval"].astype(int))
    stage_compensation = train_stage_model(X_train, train_df["delayed_compensation"].astype(int), X_val, val_df["delayed_compensation"].astype(int))
    stage_possession = train_stage_model(X_train, train_df["delayed_possession"].astype(int), X_val, val_df["delayed_possession"].astype(int))

    # Save artifacts
    joblib.dump(baseline, MODELS_DIR / "baseline.joblib")
    joblib.dump(xgb_raw, MODELS_DIR / "xgb_raw.joblib")
    joblib.dump(calibrator, VERSION_DIR / "classifier_calibrated.joblib")
    joblib.dump(regressor, VERSION_DIR / "regressor.joblib")
    joblib.dump(stage_approval, VERSION_DIR / "stage_approval.joblib")
    joblib.dump(stage_compensation, VERSION_DIR / "stage_compensation.joblib")
    joblib.dump(stage_possession, VERSION_DIR / "stage_possession.joblib")

    version_meta = {
        "version": "v1",
        "feature_order": FEATURE_COLUMNS,
        "project_type_order": PROJECT_TYPE_ORDER,
        "current_stage_order": CURRENT_STAGE_ORDER,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "calibration_method": calibration_method,
        "delay_days_regression_mode": "direct_regressor_output_scaled_by_delay_probability",
        "stage_rr_formula": "clip(1 - rr_progress_pct / 100, 0, 1)",
    }
    with open(VERSION_DIR / "meta.json", "w", encoding="utf-8") as fh:
        json.dump(version_meta, fh, indent=2)

    # Final metrics with exact required keys only
    final_metrics = {
        "pr_auc": float(calibrated_metrics["pr_auc"]),
        "roc_auc": float(calibrated_metrics["roc_auc"]),
        "recall": float(calibrated_metrics["recall"]),
        "f1": float(calibrated_metrics["f1"]),
        "brier": float(brier_after),
        "top10_recall": float(calibrated_metrics["top10_recall"]),
        "confusion_matrix": calibrated_metrics["confusion_matrix"],
        "mae_days": float(mae_days),
    }
    save_metrics_json(VERSION_DIR / "metrics.json", final_metrics)
    save_metrics_json(MODELS_DIR / "metrics.json", {"baseline": baseline_metrics, "xgb_raw": xgb_metrics})

    rel_table = reliability_table(calibrated_probs, y_test, bins=10)
    with open(VERSION_DIR / "reliability_table.json", "w", encoding="utf-8") as fh:
        json.dump(rel_table, fh, indent=2)

    save_active_version("v1")

    print("Calibration summary")
    print({
        "brier_before": round(brier_before, 6),
        "brier_after": round(brier_after, 6),
        "calibration_method": calibration_method,
        "mae_days": round(mae_days, 4),
        "rmse_days": round(rmse_days, 4),
    })
    print("Final v1 metrics")
    print(json.dumps(final_metrics, indent=2))


if __name__ == "__main__":
    main()
