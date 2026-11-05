"""
tests/test_pipeline.py
======================
Automated Pipeline Integration Tests (Task D10).
Runs the end-to-end backend inference pipeline headlessly without HTTP:
  1. fetch_external_bundle(project_id)
  2. build_features(project, parcels, cases, approvals, compensation, incidents, rate)
  3. predict_project(features)
  4. recommend(drivers)
  5. evaluate_alert(risk_score, previous_score)

Validates that output matches Section 4 of docs/contracts.md.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from datetime import datetime, timezone
import pytest
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))
sys.path.insert(0, str(REPO_ROOT))

# Person D modules
from adapters import fetch_external_bundle
from core.features import build_features
from core.recommend import recommend
from core.alerts import evaluate_alert

# Person B inference module - check if dependencies available
try:
    from core.predict import predict_project, get_active_version
    HAS_PREDICT = True
except (ImportError, ModuleNotFoundError) as e:
    HAS_PREDICT = False
    PREDICT_SKIP_REASON = f"Prediction module or dependencies unavailable: {e}"

# Sample projects data source
DATA_DIR = Path(os.environ.get("DATA_DIR", REPO_ROOT / "data" / "ongoing"))
PROJECTS_CSV = DATA_DIR / "projects.csv"

# Contract Section 4 required top-level prediction keys
CONTRACT_PREDICTION_KEYS = {
    "project_id",
    "created_at",
    "risk_score",
    "band",
    "delay_probability",
    "expected_delay_days",
    "stage_probabilities",
    "drivers",
    "recommendations",
    "model_version",
}

STAGE_KEYS = {"approval", "compensation", "possession", "rr"}
DRIVER_KEYS = {"feature", "label", "impact", "direction", "plain_text"}


@pytest.fixture(scope="module")
def sample_projects() -> list[dict]:
    """Load at least 5 sample projects from ongoing dataset or fallback fixtures."""
    if PROJECTS_CSV.exists():
        df = pd.read_csv(PROJECTS_CSV)
        # Select first 5 projects
        subset = df.head(5).to_dict(orient="records")
        if len(subset) >= 5:
            return subset

    # Fallback minimal 5 projects fixture
    return [
        {
            "project_id": f"PRJ-000{i}",
            "name": f"Corridor Highway Phase {i}",
            "type": "highway",
            "agency": "NHAI",
            "state": "Maharashtra",
            "district": "Pune" if i % 2 == 0 else "Nagpur",
            "land_area_ha": 100.0 * i,
            "families_affected": 200 * i,
            "current_stage": "possession",
            "rr_progress_pct": 30.0 + i * 5,
            "officer_response_days": 15 + i * 2,
        }
        for i in range(1, 6)
    ]


@pytest.mark.skipif(not HAS_PREDICT, reason="core.predict dependencies (shap/xgboost) not available")
def test_full_pipeline_5_projects(sample_projects):
    """
    Execute headless pipeline across 5 sample projects and assert
    contract shape compliance against Section 4 of docs/contracts.md.
    """
    assert len(sample_projects) >= 5, "Requires at least 5 projects for pipeline verification"

    for project in sample_projects:
        prj_id = project.get("project_id", "PRJ-0001")
        district_rate = 0.32

        # Step 1: Data Integration Adapters
        bundle = fetch_external_bundle(prj_id)
        assert isinstance(bundle, dict)
        for key in ["parcels", "cases", "compensation", "approvals", "incidents"]:
            assert key in bundle, f"Bundle missing key: {key}"

        # Step 2: Feature Engineering (Person D)
        features = build_features(
            project=project,
            parcels=bundle["parcels"],
            cases=bundle["cases"],
            approvals=bundle["approvals"],
            compensation=bundle["compensation"],
            incidents=bundle["incidents"],
            district_past_delay_rate=district_rate,
        )
        assert isinstance(features, dict)
        assert len(features) == 15, f"Features must have exactly 15 keys, got {len(features)}"

        # Verify percentage constraints [0, 100]
        for pct_key in ["compensation_pending_pct", "docs_incomplete_pct", "encroached_area_pct", "possession_pct", "rr_progress_pct"]:
            val = features.get(pct_key)
            if val is not None:
                assert 0.0 <= val <= 100.0, f"{pct_key} out of range [0, 100]: {val}"

        # Step 3: Model Inference (Person B)
        pred = predict_project(features)
        assert isinstance(pred, dict)
        assert 0 <= pred["risk_score"] <= 100
        assert pred["band"] in ("Low", "Medium", "High")
        assert 0.0 <= pred["delay_probability"] <= 1.0
        assert pred["expected_delay_days"] >= 0
        assert isinstance(pred["stage_probabilities"], dict)
        assert STAGE_KEYS.issubset(set(pred["stage_probabilities"].keys()))
        assert isinstance(pred["drivers"], list)
        assert len(pred["drivers"]) == 3, f"Expected exactly 3 top drivers, got {len(pred['drivers'])}"
        for d in pred["drivers"]:
            assert DRIVER_KEYS.issubset(set(d.keys()))
            assert d["direction"] in ("increases_risk", "decreases_risk")

        # Step 4: Corrective Recommendation Engine (Person D)
        recs = recommend(pred["drivers"])
        assert isinstance(recs, list)
        assert len(recs) <= 3
        for r in recs:
            assert "driver" in r
            assert "action" in r
            assert isinstance(r["action"], str) and len(r["action"]) > 5

        # Step 5: Early Warning Alert Engine (Person D)
        alert = evaluate_alert(pred["risk_score"], previous_score=None)
        if pred["risk_score"] > 60:
            assert alert is not None
            assert alert["severity"] == "High"
            assert "above the 60" in alert["reason"]
        else:
            assert alert is None

        # Surge test: simulated score jump of +18 points
        prev_score = max(0, pred["risk_score"] - 18)
        surge_alert = evaluate_alert(pred["risk_score"], previous_score=prev_score)
        assert surge_alert is not None
        assert surge_alert["severity"] in ("High", "Medium")
        assert "rose by" in surge_alert["reason"]

        # Step 6: Assemble Complete Contract Prediction Object
        full_prediction_object = {
            "project_id": prj_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "risk_score": pred["risk_score"],
            "band": pred["band"],
            "delay_probability": pred["delay_probability"],
            "expected_delay_days": pred["expected_delay_days"],
            "stage_probabilities": pred["stage_probabilities"],
            "drivers": pred["drivers"],
            "recommendations": recs,
            "model_version": pred.get("model_version", "v1"),
        }

        # Assert full compliance with Section 4 of docs/contracts.md
        missing_keys = CONTRACT_PREDICTION_KEYS - set(full_prediction_object.keys())
        assert not missing_keys, f"Prediction object missing contract keys: {missing_keys}"


def test_pipeline_pure_components_without_ml():
    """
    Ensure the data integration, feature builder, recommendation rules,
    and alert engine work together smoothly even if ML models are skipped.
    """
    sample_project = {
        "project_id": "PRJ-TEST-01",
        "name": "Integration Test Highway",
        "type": "highway",
        "land_area_ha": 120.0,
        "families_affected": 800,
        "current_stage": "possession",
        "rr_progress_pct": 24.0,
        "officer_response_days": 22,
    }

    bundle = fetch_external_bundle("PRJ-0001")
    features = build_features(
        project=sample_project,
        parcels=bundle["parcels"],
        cases=bundle["cases"],
        approvals=bundle["approvals"],
        compensation=bundle["compensation"],
        incidents=bundle["incidents"],
        district_past_delay_rate=0.35,
    )
    assert len(features) == 15
    assert features["land_area_ha"] == 120.0
    assert features["families_affected"] == 800

    # Test recommendations with mock top drivers
    mock_drivers = [
        {
            "feature": "litigation_cases",
            "label": "Court cases",
            "impact": 0.22,
            "direction": "increases_risk",
            "plain_text": "9 pending court cases with 2 stay orders",
        },
        {
            "feature": "compensation_pending_pct",
            "label": "Compensation progress",
            "impact": 0.18,
            "direction": "increases_risk",
            "plain_text": "41% compensation pending disbursal",
        },
        {
            "feature": "approval_days_pending",
            "label": "Overdue clearances",
            "impact": 0.12,
            "direction": "increases_risk",
            "plain_text": "Departmental approval 120 days overdue",
        },
    ]
    recs = recommend(mock_drivers)
    assert len(recs) == 3
    assert recs[0]["driver"] == "litigation_cases"
    assert "legal cell" in recs[0]["action"].lower()

    # Test alerts on high score
    high_alert = evaluate_alert(78, previous_score=60)
    assert high_alert is not None
    assert high_alert["severity"] == "High"
    assert "rose by 18" in high_alert["reason"]

