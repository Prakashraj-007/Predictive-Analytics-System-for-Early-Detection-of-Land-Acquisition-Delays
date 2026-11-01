from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

try:
    from backend.ml.explain import top_drivers
    from backend.ml.preprocess import FEATURE_COLUMNS, prepare
except ImportError:  # pragma: no cover
    from ml.explain import top_drivers
    from ml.preprocess import FEATURE_COLUMNS, prepare

ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "models"
ACTIVE_VERSION_PATH = MODELS_DIR / "ACTIVE_VERSION"

_MODEL_CACHE: dict[str, dict[str, Any]] = {}
_MODEL_VERSION: str | None = None


def get_active_version() -> str:
    if ACTIVE_VERSION_PATH.exists():
        version = ACTIVE_VERSION_PATH.read_text(encoding="utf-8").strip()
        if version:
            return version
    return "v1"


def _load_model_bundle(version: str) -> dict[str, Any]:
    global _MODEL_CACHE, _MODEL_VERSION
    if _MODEL_VERSION == version and version in _MODEL_CACHE:
        return _MODEL_CACHE[version]

    version_dir = MODELS_DIR / version
    calibrator_path = version_dir / "classifier_calibrated.joblib"
    regressor_path = version_dir / "regressor.joblib"
    stage_paths = {
        "approval": version_dir / "stage_approval.joblib",
        "compensation": version_dir / "stage_compensation.joblib",
        "possession": version_dir / "stage_possession.joblib",
    }

    calibrator = joblib.load(calibrator_path) if calibrator_path.exists() else joblib.load(MODELS_DIR / "xgb_raw.joblib")
    regressor = joblib.load(regressor_path) if regressor_path.exists() else None
    stages = {name: joblib.load(path) for name, path in stage_paths.items() if path.exists()}

    bundle = {"calibrator": calibrator, "regressor": regressor, "stages": stages}
    _MODEL_CACHE[version] = bundle
    _MODEL_VERSION = version
    return bundle


def _band_for_score(score: int) -> str:
    if score < 30:
        return "Low"
    if score <= 60:
        return "Medium"
    return "High"


def _as_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return float(default)
    try:
        if isinstance(value, str):
            value = value.strip()
            if value == "":
                return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _normalize_features(features: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(features)
    for key in FEATURE_COLUMNS:
        if key not in normalized:
            normalized[key] = None
        if key in {"project_type", "current_stage"}:
            value = normalized.get(key)
            normalized[key] = value if value is not None and str(value) != "nan" else (
                "planning" if key == "current_stage" else "highway"
            )
        else:
            value = normalized.get(key)
            if value is None or str(value).lower() == "none" or str(value).lower() == "nan":
                normalized[key] = np.nan
            else:
                try:
                    normalized[key] = float(value)
                except (TypeError, ValueError):
                    normalized[key] = np.nan
    return normalized


def _validate_feature_keys(features: dict[str, Any]) -> None:
    missing = [key for key in FEATURE_COLUMNS if key not in features]
    unknown = sorted(set(features.keys()) - set(FEATURE_COLUMNS))
    if missing or unknown:
        details = []
        if missing:
            details.append(f"missing: {missing}")
        if unknown:
            details.append(f"unknown: {unknown}")
        raise ValueError("Invalid feature dict: " + "; ".join(details))


def _predict_probability(calibrator: Any, X_row: pd.DataFrame) -> float:
    if hasattr(calibrator, "predict_proba"):
        prob = calibrator.predict_proba(X_row)
        if prob.ndim == 2 and prob.shape[1] > 1:
            return float(prob[0, 1])
        if prob.ndim == 1:
            return float(prob[0])
    if hasattr(calibrator, "predict"):
        pred = calibrator.predict(X_row)
        return float(np.asarray(pred).reshape(-1)[0])
    raise TypeError("Model does not provide probability output")


def _heuristic_probability(features: dict[str, Any]) -> float:
    lit = _as_float(features.get("litigation_cases"), 0.0)
    stay = _as_float(features.get("stay_orders"), 0.0)
    ownership = _as_float(features.get("ownership_disputes"), 0.0)
    comp = _as_float(features.get("compensation_pending_pct"), 0.0)
    approval = _as_float(features.get("approval_days_pending"), 0.0)
    docs = _as_float(features.get("docs_incomplete_pct"), 0.0)
    officer = _as_float(features.get("officer_response_days"), 0.0)
    enc = _as_float(features.get("encroached_area_pct"), 0.0)
    possession = _as_float(features.get("possession_pct"), 0.0)
    rr = _as_float(features.get("rr_progress_pct"), 0.0)
    district = _as_float(features.get("district_past_delay_rate"), 0.25)

    logit = -2.1 + 0.18 * lit + 0.25 * stay + 0.12 * ownership + 0.018 * comp + 0.006 * approval
    logit += 0.012 * docs + 0.015 * officer + 0.025 * enc + 1.8 * district - 0.015 * possession - 0.013 * rr
    if str(features.get("project_type", "")).lower() in {"highway", "rail"}:
        logit += 0.35
    if str(features.get("current_stage", "")).lower() in {"compensation", "possession", "rr"}:
        logit += 0.2
    prob = 1.0 / (1.0 + np.exp(-logit))
    return float(np.clip(prob, 0.0, 1.0))


def predict_project(features: dict) -> dict:
    feature_copy = dict(features)
    _validate_feature_keys(feature_copy)
    normalized = _normalize_features(feature_copy)
    X = prepare(pd.DataFrame([normalized], columns=FEATURE_COLUMNS))

    version = get_active_version()
    bundle = _load_model_bundle(version)
    calibrator = bundle["calibrator"]
    regressor = bundle["regressor"]

    model_prob = _predict_probability(calibrator, X)
    heuristic_prob = _heuristic_probability(normalized)
    prob = float(np.clip(max(model_prob, heuristic_prob * 0.9 + 0.1 * model_prob), 0.0, 1.0))
    risk_score = int(round(prob * 100))
    band = _band_for_score(risk_score)

    expected_delay_days = 0
    if regressor is not None:
        raw_days = float(regressor.predict(X)[0])
        expected_delay_days = max(0, int(round(raw_days))) if prob >= 0.5 else 0

    stage_probabilities: dict[str, float] = {}
    for stage_name, stage_model in bundle["stages"].items():
        if stage_name in {"approval", "compensation", "possession"}:
            p = float(stage_model.predict_proba(X)[0, 1])
            stage_probabilities[stage_name] = float(np.clip(p, 0.0, 1.0))

    rr_progress = _as_float(normalized.get("rr_progress_pct"), 0.0)
    rr_probability = float(np.clip(0.5 * (1.0 - rr_progress / 100.0) + 0.5 * prob, 0.0, 1.0))
    stage_probabilities["rr"] = rr_probability

    drivers = top_drivers(normalized, version, k=3)
    result = {
        "risk_score": risk_score,
        "band": band,
        "delay_probability": float(np.clip(prob, 0.0, 1.0)),
        "expected_delay_days": expected_delay_days,
        "stage_probabilities": {
            "approval": float(np.clip(stage_probabilities.get("approval", prob), 0.0, 1.0)),
            "compensation": float(np.clip(stage_probabilities.get("compensation", prob), 0.0, 1.0)),
            "possession": float(np.clip(stage_probabilities.get("possession", prob), 0.0, 1.0)),
            "rr": float(np.clip(stage_probabilities["rr"], 0.0, 1.0)),
        },
        "drivers": drivers,
        "model_version": version,
    }
    return result


def what_if(features: dict, changes: dict) -> dict:
    current = predict_project(features)
    modified = dict(features)
    allowed_keys = {"compensation_pending_pct", "litigation_cases", "docs_incomplete_pct", "approval_days_pending"}
    for key, value in changes.items():
        if key not in allowed_keys or value is None:
            continue
        if key.endswith("_pct"):
            modified[key] = max(0.0, min(100.0, float(value)))
        else:
            modified[key] = max(0, int(value))
    new = predict_project(modified)
    return {
        "current_score": current["risk_score"],
        "new_score": new["risk_score"],
        "change": new["risk_score"] - current["risk_score"],
    }


if __name__ == "__main__":
    example = {
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

    result = predict_project(example)
    print("Worked example:")
    print(result)
    print("High expected:", result["band"] == "High")

    reduced = what_if(example, {"compensation_pending_pct": 20.0})
    print("What-if reduction:")
    print(reduced)
    print("Drop confirmed:", reduced["new_score"] < reduced["current_score"])
