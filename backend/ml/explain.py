from __future__ import annotations

import json
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap

try:
    from backend.ml.preprocess import CURRENT_STAGE_ORDER, FEATURE_COLUMNS, PROJECT_TYPE_ORDER, prepare
except ImportError:  # pragma: no cover
    from ml.preprocess import CURRENT_STAGE_ORDER, FEATURE_COLUMNS, PROJECT_TYPE_ORDER, prepare

ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "models"
DATASET_PATH = ROOT / "data" / "historical_projects.csv"

LABELS = {
    "land_area_ha": "Land area",
    "families_affected": "Affected families",
    "project_type": "Project type",
    "litigation_cases": "Court cases",
    "stay_orders": "Stay orders",
    "ownership_disputes": "Ownership disputes",
    "compensation_pending_pct": "Compensation pending",
    "approval_days_pending": "Pending approvals",
    "docs_incomplete_pct": "Incomplete documents",
    "officer_response_days": "Officer response time",
    "encroached_area_pct": "Encroachment",
    "possession_pct": "Possession progress",
    "rr_progress_pct": "RR progress",
    "current_stage": "Current stage",
    "district_past_delay_rate": "District delay rate",
}

_EXPLAINERS: dict[str, Any] = {}


def _raw_model_for_version(version: str):
    version_dir = MODELS_DIR / version
    calibrated_path = version_dir / "classifier_calibrated.joblib"
    if calibrated_path.exists():
        try:
            calibrator = joblib.load(calibrated_path)
            for name in ["estimator", "estimator_", "base_estimator"]:
                if hasattr(calibrator, name):
                    model = getattr(calibrator, name)
                    if model is not None:
                        return model
            if hasattr(calibrator, "calibrated_classifiers_") and calibrator.calibrated_classifiers_:
                return calibrator.calibrated_classifiers_[0].estimator
        except Exception:
            pass
    fallback = MODELS_DIR / "xgb_raw.joblib"
    if fallback.exists():
        return joblib.load(fallback)
    raise FileNotFoundError(f"No classifier model found for version '{version}'")


def get_explainer(version: str):
    cache = _EXPLAINERS.get(version)
    if cache is not None:
        return cache

    raw_model = _raw_model_for_version(version)
    explainer = shap.TreeExplainer(raw_model)
    _EXPLAINERS[version] = explainer
    return explainer


@lru_cache(maxsize=1)
def _average_feature_row() -> pd.Series:
    if not DATASET_PATH.exists():
        return pd.Series({
            "land_area_ha": 150.0,
            "families_affected": 400,
            "project_type": PROJECT_TYPE_ORDER[0],
            "litigation_cases": 2,
            "stay_orders": 0,
            "ownership_disputes": 1,
            "compensation_pending_pct": 25.0,
            "approval_days_pending": 30,
            "docs_incomplete_pct": 15.0,
            "officer_response_days": 20,
            "encroached_area_pct": 5.0,
            "possession_pct": 45.0,
            "rr_progress_pct": 35.0,
            "current_stage": CURRENT_STAGE_ORDER[0],
            "district_past_delay_rate": 0.25,
        })

    df = pd.read_csv(DATASET_PATH)
    row: dict[str, Any] = {}
    for feature in FEATURE_COLUMNS:
        if feature in {"project_type", "current_stage"}:
            values = df[feature].dropna()
            row[feature] = values.mode().iloc[0] if not values.empty else "planning" if feature == "current_stage" else "highway"
        else:
            series = pd.to_numeric(df[feature], errors="coerce")
            row[feature] = float(series.median())
    return pd.Series(row)


def _project_probability(model: Any, features: dict[str, Any]) -> float:
    X = prepare(pd.DataFrame([features], columns=FEATURE_COLUMNS))
    prob = model.predict_proba(X)
    if prob.ndim == 2 and prob.shape[1] > 1:
        return float(prob[0, 1])
    if prob.ndim == 1:
        return float(prob[0])
    return float(np.asarray(prob).reshape(-1)[-1])


def _coerce_feature_row(features: dict[str, Any]) -> dict[str, Any]:
    row = {}
    for feature in FEATURE_COLUMNS:
        value = features.get(feature)
        if pd.isna(value) if isinstance(value, (float, int, np.generic)) else False:
            value = None
        if feature in {"project_type", "current_stage"}:
            row[feature] = value if value is not None else ("planning" if feature == "current_stage" else PROJECT_TYPE_ORDER[0])
        else:
            row[feature] = None if value is None else float(value)
    return row


def _shap_values_for_row(explainer: Any, row_df: pd.DataFrame):
    values = explainer.shap_values(row_df)
    arr = np.asarray(values)
    if arr.ndim == 3:
        arr = arr[0]
    elif arr.ndim == 2 and arr.shape[0] == 1:
        arr = arr[0]
    elif arr.ndim == 2 and arr.shape[1] == 1:
        arr = arr[:, 0]
    return np.asarray(arr, dtype=float).reshape(-1)


def _feature_plain_text(feature: str, value: Any) -> str:
    numeric = float(value) if value is not None and not pd.isna(value) else 0.0
    stage = str(value)
    if feature == "litigation_cases":
        stay = 0 if "stay_orders" not in globals() else 0
        return f"{int(round(numeric))} court cases, {int(round(float(value if value is not None else 0)))} with stay orders, are the biggest cause of delay risk."
    if feature == "stay_orders":
        return f"{int(round(numeric))} stay orders are creating legal drag that keeps the project at risk."
    if feature == "ownership_disputes":
        return f"{int(round(numeric))} ownership disputes are blocking clear title and slowing acquisition."
    if feature == "compensation_pending_pct":
        return f"{numeric:.0f}% of the compensation is still unpaid."
    if feature == "approval_days_pending":
        return f"Approvals are pending for {int(round(numeric))} days."
    if feature == "docs_incomplete_pct":
        return f"{numeric:.0f}% of the land records are incomplete."
    if feature == "officer_response_days":
        return f"{numeric:.0f} days average officer response time."
    if feature == "encroached_area_pct":
        return f"{numeric:.0f}% of the land is encroached."
    if feature == "possession_pct":
        return f"{numeric:.0f}% of the land has been handed over already."
    if feature == "rr_progress_pct":
        return f"{numeric:.0f}% of the resettlement work is complete."
    if feature == "district_past_delay_rate":
        return f"This district has a historical delay rate of {numeric:.2f}."
    if feature == "current_stage":
        return f"The project is in the {stage} stage, which raises execution risk."
    if feature == "project_type":
        return f"{str(value).title()} project conditions are increasing delivery risk."
    if feature == "families_affected":
        return f"{int(round(numeric))} families are affected, increasing the resettlement burden."
    if feature == "land_area_ha":
        return f"{numeric:.0f} hectares of land make acquisition and coordination more difficult."
    return f"The {LABELS.get(feature, feature)} signal is a notable driver of delay risk."


def _plain_text_for_row(feature: str, values: dict[str, Any]) -> str:
    if feature == "litigation_cases":
        stay_orders = int(float(values.get("stay_orders") or 0))
        return f"{int(float(values.get(feature) or 0))} court cases, {stay_orders} with stay orders, are the biggest cause of delay risk."
    if feature == "stay_orders":
        return f"{int(float(values.get(feature) or 0))} stay orders are creating legal drag that keeps the project at risk."
    if feature == "ownership_disputes":
        return f"{int(float(values.get(feature) or 0))} ownership disputes are blocking clear title and slowing acquisition."
    if feature == "compensation_pending_pct":
        return f"{float(values.get(feature) or 0):.0f}% of the compensation is still unpaid."
    if feature == "approval_days_pending":
        return f"Approvals are pending for {int(float(values.get(feature) or 0))} days."
    if feature == "docs_incomplete_pct":
        return f"{float(values.get(feature) or 0):.0f}% of the land records are incomplete."
    if feature == "officer_response_days":
        return f"{float(values.get(feature) or 0):.0f} days average officer response time."
    if feature == "encroached_area_pct":
        return f"{float(values.get(feature) or 0):.0f}% of the land is encroached."
    if feature == "possession_pct":
        return f"{float(values.get(feature) or 0):.0f}% of the land has been handed over already."
    if feature == "rr_progress_pct":
        return f"{float(values.get(feature) or 0):.0f}% of the resettlement work is complete."
    if feature == "district_past_delay_rate":
        return f"This district has a historical delay rate of {float(values.get(feature) or 0):.2f}."
    if feature == "current_stage":
        return f"The project is in the {values.get(feature)} stage, which raises execution risk."
    if feature == "project_type":
        return f"{str(values.get(feature)).title()} project conditions are increasing delivery risk."
    if feature == "families_affected":
        return f"{int(float(values.get(feature) or 0))} families are affected, increasing the resettlement burden."
    if feature == "land_area_ha":
        return f"{float(values.get(feature) or 0):.0f} hectares of land make acquisition and coordination more difficult."
    return f"The {LABELS.get(feature, feature)} signal is a notable driver of delay risk."


def top_drivers(features: dict[str, Any], version: str, k: int = 3) -> list[dict]:
    if k <= 0:
        return []

    row = {**_average_feature_row().to_dict(), **features}
    row_df = prepare(pd.DataFrame([row], columns=FEATURE_COLUMNS))
    explainer = get_explainer(version)
    shap_values = _shap_values_for_row(explainer, row_df)
    if shap_values.size == 0:
        return []

    model = _raw_model_for_version(version)
    project_prob = _project_probability(model, row)
    avg_row = _average_feature_row().to_dict()
    avg_prob = _project_probability(model, avg_row)
    delta_p = project_prob - avg_prob

    total_abs = float(np.sum(np.abs(shap_values)))
    if total_abs <= 0:
        total_abs = 1.0

    ranked = []
    for idx, feature in enumerate(FEATURE_COLUMNS):
        shap_value = float(shap_values[idx])
        impact = float(delta_p * shap_value / total_abs)
        rank = {
            "feature": feature,
            "label": LABELS.get(feature, feature.replace("_", " ").title()),
            "impact": impact,
            "direction": "increases_risk" if impact > 0 else "decreases_risk",
            "plain_text": _plain_text_for_row(feature, row),
        }
        ranked.append(rank)

    ranked.sort(key=lambda item: abs(item["impact"]), reverse=True)
    positive = [item for item in ranked if item["impact"] > 0]
    selected = positive[:k]
    if len(selected) < k:
        seen = {item["feature"] for item in selected}
        for item in ranked:
            if item["feature"] not in seen:
                selected.append(item)
                seen.add(item["feature"])
            if len(selected) >= k:
                break

    final = []
    for item in selected[:k]:
        item = dict(item)
        item["impact"] = round(float(item["impact"]), 4)
        final.append(item)
    return final


if __name__ == "__main__":
    sample_features = {
        "land_area_ha": 120.0,
        "families_affected": 800,
        "project_type": "highway",
        "litigation_cases": 9,
        "stay_orders": 2,
        "ownership_disputes": 3,
        "compensation_pending_pct": 41.0,
        "approval_days_pending": 120,
        "docs_incomplete_pct": 22.0,
        "officer_response_days": 22,
        "encroached_area_pct": 8.0,
        "possession_pct": 32.0,
        "rr_progress_pct": 18.0,
        "current_stage": "compensation",
        "district_past_delay_rate": 0.41,
    }

    start = time.perf_counter()
    drivers = top_drivers(sample_features, "v1")
    elapsed_ms = (time.perf_counter() - start) * 1000
    print(json.dumps({"elapsed_ms": round(elapsed_ms, 2), "drivers": drivers}, indent=2))
