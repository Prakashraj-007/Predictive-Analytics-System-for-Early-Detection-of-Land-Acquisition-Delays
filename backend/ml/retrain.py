from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

try:
    import ml.train as train_module
except ImportError:  # pragma: no cover
    from backend.ml import train as train_module

ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "models"
ACTIVE_VERSION_PATH = MODELS_DIR / "ACTIVE_VERSION"
HISTORICAL_DATA_PATH = ROOT / "data" / "historical_projects.csv"
REQUIRED_COLUMNS = [
    "project_id",
    "planned_start",
    *train_module.FEATURE_COLUMNS,
    "is_delayed",
    "delay_days",
    "delayed_approval",
    "delayed_compensation",
    "delayed_possession",
]


def _latest_version_number() -> int:
    versions = []
    if MODELS_DIR.exists():
        for child in MODELS_DIR.iterdir():
            if child.is_dir() and child.name.startswith("v"):
                match = re.fullmatch(r"v(\d+)", child.name)
                if match:
                    versions.append(int(match.group(1)))
    return max(versions, default=1)


def _next_version() -> str:
    return f"v{_latest_version_number() + 1}"


def _active_version() -> str:
    if ACTIVE_VERSION_PATH.exists():
        version = ACTIVE_VERSION_PATH.read_text(encoding="utf-8").strip()
        if version:
            return version
    return "v1"


def _validate_history_columns(df: pd.DataFrame) -> None:
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")


def _load_before_metrics() -> dict[str, Any]:
    version = _active_version()
    metrics_path = MODELS_DIR / version / "metrics.json"
    if not metrics_path.exists():
        raise FileNotFoundError(f"No metrics found for active version '{version}' at {metrics_path}")
    with open(metrics_path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _build_training_bundle(df: pd.DataFrame, version: str) -> dict[str, Any]:
    version_dir = MODELS_DIR / version
    version_dir.mkdir(parents=True, exist_ok=True)

    train_df, val_df, test_df = train_module.time_split(df)
    X_train, y_train = train_module.make_features_target(train_df)
    X_val, y_val = train_module.make_features_target(val_df)
    X_test, y_test = train_module.make_features_target(test_df)

    baseline = train_module.fit_baseline(X_train, y_train)
    xgb_raw = train_module.fit_xgb_binary(X_train, y_train, X_val, y_val)
    baseline_metrics = train_module.evaluate_binary(baseline, X_test, y_test)
    xgb_metrics = train_module.evaluate_binary(xgb_raw, X_test, y_test)

    xgb_raw, calibrator, calibration_method = train_module.fit_calibrated_xgb(X_train, y_train, X_val, y_val)
    calibrated_probs = calibrator.predict_proba(X_test)[:, 1]
    calibrated_metrics = train_module.evaluate_binary(calibrator, X_test, y_test)
    brier_before = float(train_module.brier_score_loss(y_test, xgb_raw.predict_proba(X_test)[:, 1]))
    brier_after = float(train_module.brier_score_loss(y_test, calibrated_probs))

    delayed_rows = df[df["is_delayed"] == 1].copy()
    delay_train_df, delay_val_df, delay_test_df = train_module.time_split(delayed_rows)
    X_delay_train, y_delay_train = train_module.make_features_target(delay_train_df, target="delay_days")
    X_delay_val, y_delay_val = train_module.make_features_target(delay_val_df, target="delay_days")
    X_delay_test, y_delay_test = train_module.make_features_target(delay_test_df, target="delay_days")
    regressor = train_module.fit_regressor(X_delay_train, y_delay_train, X_delay_val, y_delay_val)
    delay_predictions = regressor.predict(X_delay_test)
    mae_days = float(train_module.mean_absolute_error(y_delay_test, delay_predictions))
    rmse_days = float((train_module.mean_squared_error(y_delay_test, delay_predictions)) ** 0.5)

    stage_approval = train_module.train_stage_model(
        X_train,
        train_df["delayed_approval"].astype(int),
        X_val,
        val_df["delayed_approval"].astype(int),
    )
    stage_compensation = train_module.train_stage_model(
        X_train,
        train_df["delayed_compensation"].astype(int),
        X_val,
        val_df["delayed_compensation"].astype(int),
    )
    stage_possession = train_module.train_stage_model(
        X_train,
        train_df["delayed_possession"].astype(int),
        X_val,
        val_df["delayed_possession"].astype(int),
    )

    joblib.dump(baseline, version_dir / "baseline.joblib")
    joblib.dump(xgb_raw, version_dir / "xgb_raw.joblib")
    joblib.dump(calibrator, version_dir / "classifier_calibrated.joblib")
    joblib.dump(regressor, version_dir / "regressor.joblib")
    joblib.dump(stage_approval, version_dir / "stage_approval.joblib")
    joblib.dump(stage_compensation, version_dir / "stage_compensation.joblib")
    joblib.dump(stage_possession, version_dir / "stage_possession.joblib")

    meta = {
        "version": version,
        "feature_order": train_module.FEATURE_COLUMNS,
        "project_type_order": train_module.PROJECT_TYPE_ORDER,
        "current_stage_order": train_module.CURRENT_STAGE_ORDER,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "calibration_method": calibration_method,
        "delay_days_regression_mode": "direct_regressor_output_scaled_by_delay_probability",
        "stage_rr_formula": "clip(1 - rr_progress_pct / 100, 0, 1)",
    }
    with open(version_dir / "meta.json", "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

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
    train_module.save_metrics_json(version_dir / "metrics.json", final_metrics)
    train_module.save_metrics_json(MODELS_DIR / "metrics.json", {"baseline": baseline_metrics, "xgb_raw": xgb_metrics})

    rel_table = train_module.reliability_table(calibrated_probs, y_test, bins=10)
    with open(version_dir / "reliability_table.json", "w", encoding="utf-8") as fh:
        json.dump(rel_table, fh, indent=2)

    return {
        "version": version,
        "before": float(brier_before),
        "after": float(brier_after),
        "metrics": final_metrics,
        "calibration_method": calibration_method,
        "mae_days": mae_days,
        "rmse_days": rmse_days,
    }


def retrain(csv_path: str) -> dict[str, Any]:
    csv_file = Path(csv_path)
    if not csv_file.exists():
        raise FileNotFoundError(f"CSV not found: {csv_file}")

    upload_df = pd.read_csv(csv_file)
    _validate_history_columns(upload_df)

    historical_df = pd.read_csv(HISTORICAL_DATA_PATH)
    combined_df = pd.concat([historical_df, upload_df[REQUIRED_COLUMNS]], ignore_index=True)
    combined_df = combined_df.sort_values("planned_start").drop_duplicates(subset=["project_id"], keep="last").reset_index(drop=True)

    before = _load_before_metrics()
    new_version = _next_version()
    training_result = _build_training_bundle(combined_df, new_version)
    after = training_result["metrics"]

    new_pr_auc = float(after["pr_auc"])
    old_pr_auc = float(before.get("pr_auc", 0.0))
    promoted = new_pr_auc >= (old_pr_auc - 0.01)

    if promoted:
        ACTIVE_VERSION_PATH.write_text(new_version, encoding="utf-8")
    else:
        ACTIVE_VERSION_PATH.write_text(_active_version(), encoding="utf-8")

    return {
        "before": before,
        "after": after,
        "new_version": new_version,
        "promoted": promoted,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Retrain the LandSentinel delay model with a new historical CSV upload.")
    parser.add_argument("--csv", required=True, help="Path to a CSV file with the historical training columns.")
    args = parser.parse_args()
    result = retrain(args.csv)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
