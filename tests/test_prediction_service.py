"""
Tests for Task A8: Prediction Service, What-If Simulation, and Predictions Router.
Tests both isolated domain logic and end-to-end HTTP endpoints.
Strictly verifies contracts.md section 3, 4, 5, and A8 specs.
"""
import pytest
import os
import json
import urllib.request
import urllib.error
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, Any

backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.auth import create_mock_jwt
from app.services.prediction_service import (
    build_features,
    predict_project,
    recommend,
    evaluate_alert,
    what_if,
    run_prediction,
    simulate_what_if_service
)


# ---------------------------------------------------------------------------
# 1. Pure Unit Tests: Features, Predictions, Recs, Alerts, What-If
# ---------------------------------------------------------------------------

def test_build_features_all_15_keys():
    project = {
        "project_id": "PRJ-TEST-01",
        "type": "highway",
        "land_area_ha": 120.5,
        "families_affected": 240,
        "officer_response_days": 18,
        "rr_progress_pct": 35.0,
        "current_stage": "compensation"
    }
    parcels = [
        {"parcel_id": "P1", "area_ha": 60.0, "possession_status": "handed_over", "doc_complete": True, "ownership_dispute": False},
        {"parcel_id": "P2", "area_ha": 40.0, "possession_status": "pending", "doc_complete": False, "ownership_dispute": True},
    ]
    cases = [
        {"case_id": "C1", "status": "pending", "stay_order": True},
        {"case_id": "C2", "status": "pending", "stay_order": False},
        {"case_id": "C3", "status": "disposed", "stay_order": False},
    ]
    approvals = [
        {"approval_id": "A1", "status": "pending", "planned_date": "2026-08-01"},
        {"approval_id": "A2", "status": "cleared", "planned_date": "2026-05-01", "actual_date": "2026-05-10"},
    ]
    compensation = {
        "award_amount": 10000000,
        "disbursed_amount": 4000000,
        "disputes": 2
    }
    incidents = [
        {"incident_id": "I1", "type": "encroachment", "encroached_area_ha": 6.0}
    ]

    features = build_features(
        project=project,
        parcels=parcels,
        cases=cases,
        approvals=approvals,
        compensation=compensation,
        incidents=incidents,
        district_past_delay_rate=0.35,
        as_of="2026-11-01"
    )

    expected_keys = [
        "land_area_ha", "families_affected", "project_type", "litigation_cases",
        "stay_orders", "ownership_disputes", "compensation_pending_pct",
        "approval_days_pending", "docs_incomplete_pct", "officer_response_days",
        "encroached_area_pct", "possession_pct", "rr_progress_pct",
        "current_stage", "district_past_delay_rate"
    ]
    for k in expected_keys:
        assert k in features, f"Missing feature key: {k}"

    assert features["litigation_cases"] == 2  # 2 pending cases
    assert features["stay_orders"] == 1       # 1 stay order
    assert features["ownership_disputes"] == 3 # 1 parcel dispute + 2 compensation disputes
    assert features["compensation_pending_pct"] == 60.0  # (10M - 4M)/10M * 100
    assert features["docs_incomplete_pct"] == 50.0       # 1 of 2 incomplete
    assert features["possession_pct"] == 60.0            # 60ha of 100ha total parcels
    assert features["project_type"] == "highway"
    assert features["district_past_delay_rate"] == 0.35


def test_predict_project_shape():
    features = {
        "land_area_ha": 100.0,
        "families_affected": 150,
        "project_type": "highway",
        "litigation_cases": 4,
        "stay_orders": 1,
        "ownership_disputes": 2,
        "compensation_pending_pct": 45.0,
        "approval_days_pending": 60,
        "docs_incomplete_pct": 25.0,
        "officer_response_days": 20,
        "encroached_area_pct": 5.0,
        "possession_pct": 40.0,
        "rr_progress_pct": 30.0,
        "current_stage": "compensation",
        "district_past_delay_rate": 0.28
    }

    result = predict_project(features)
    assert 0 <= result["risk_score"] <= 100
    assert result["band"] in ("Low", "Medium", "High")
    assert 0.0 <= result["delay_probability"] <= 1.0
    assert result["expected_delay_days"] >= 0
    assert set(result["stage_probabilities"].keys()) == {"approval", "compensation", "possession", "rr"}
    assert len(result["drivers"]) == 3
    for d in result["drivers"]:
        assert "feature" in d
        assert "label" in d
        assert "impact" in d
        assert "direction" in d
        assert "plain_text" in d
    assert result["model_version"] == "v1"


def test_recommend_mapping():
    drivers = [
        {"feature": "litigation_cases", "label": "Court cases", "impact": 0.22},
        {"feature": "compensation_pending_pct", "label": "Compensation progress", "impact": 0.18},
        {"feature": "approval_days_pending", "label": "Pending approvals", "impact": 0.12}
    ]
    recs = recommend(drivers)
    assert len(recs) == 3
    drivers_in_recs = [r["driver"] for r in recs]
    assert "litigation_cases" in drivers_in_recs
    assert "compensation_pending_pct" in drivers_in_recs
    assert "approval_days_pending" in drivers_in_recs
    for r in recs:
        assert len(r["action"]) > 10


def test_evaluate_alert_conditions():
    # 1. High score (>60) on first prediction
    a1 = evaluate_alert(new_score=75, previous_score=None, threshold=60)
    assert a1 is not None
    assert a1["severity"] == "High"

    # 2. Score jump >= 15 points
    a2 = evaluate_alert(new_score=55, previous_score=35, threshold=60)
    assert a2 is not None
    assert a2["severity"] == "Medium"

    # 3. Both >60 and >=15 jump
    a3 = evaluate_alert(new_score=80, previous_score=50, threshold=60)
    assert a3 is not None
    assert a3["severity"] == "High"

    # 4. Score below threshold and no jump
    a4 = evaluate_alert(new_score=25, previous_score=20, threshold=60)
    assert a4 is None

    # 5. Flat / dropping score (no new alert)
    a5 = evaluate_alert(new_score=65, previous_score=70, threshold=60)
    # Score dropped from 70 to 65: no jump, so no new spike alert
    assert a5 is None or "High" in a5["severity"]


def test_what_if_simulation():
    features = {
        "land_area_ha": 100.0,
        "families_affected": 100,
        "project_type": "highway",
        "litigation_cases": 8,
        "stay_orders": 2,
        "ownership_disputes": 3,
        "compensation_pending_pct": 70.0,
        "approval_days_pending": 90,
        "docs_incomplete_pct": 40.0,
        "officer_response_days": 25,
        "encroached_area_pct": 10.0,
        "possession_pct": 20.0,
        "rr_progress_pct": 10.0,
        "current_stage": "compensation",
        "district_past_delay_rate": 0.35
    }

    # Reducing compensation pending to 10% and cases to 0 should lower score
    res = what_if(features, {"compensation_pending_pct": 10.0, "litigation_cases": 0})
    assert res["new_score"] < res["current_score"]
    assert res["change"] < 0
    assert res["change"] == res["new_score"] - res["current_score"]


# ---------------------------------------------------------------------------
# 2. Integration Tests: Live HTTP Server Endpoints (A8 Spec)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def live_server():
    server_port = 8009
    server_url = f"http://127.0.0.1:{server_port}"
    env = os.environ.copy()
    env["PYTHONPATH"] = os.path.abspath("backend")
    env["STUB_MODE"] = "false"

    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(server_port),
            "--log-level",
            "warning",
        ],
        cwd="backend",
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Poll /health until server is responsive
    for _ in range(40):
        try:
            with urllib.request.urlopen(f"{server_url}/health", timeout=1) as resp:
                if resp.status == 200:
                    break
        except Exception:
            time.sleep(0.3)
    else:
        proc.kill()
        raise RuntimeError("Live uvicorn server failed to start for test_prediction_service")

    yield server_url

    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()


def _http_request(url: str, method: str = "GET", token: str = None, json_data: dict = None) -> tuple[int, dict]:
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if json_data is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(json_data).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return resp.status, body
    except urllib.error.HTTPError as he:
        body = {}
        try:
            body = json.loads(he.read().decode("utf-8"))
        except Exception:
            pass
        return he.code, body


def test_get_project_prediction_shape(live_server):
    token = create_mock_jwt(user_id="admin_1", role="admin")
    status_code, data = _http_request(f"{live_server}/projects/PRJ-0001/prediction", token=token)
    assert status_code == 200
    assert data["project_id"] == "PRJ-0001"
    assert "risk_score" in data
    assert data["band"] in ("Low", "Medium", "High")
    assert "delay_probability" in data
    assert "expected_delay_days" in data
    assert "stage_probabilities" in data
    assert len(data["drivers"]) == 3
    assert len(data["recommendations"]) >= 1
    assert data["model_version"] == "v1"


def test_trigger_fresh_prediction(live_server):
    token = create_mock_jwt(user_id="admin_1", role="admin")
    status_code, data = _http_request(f"{live_server}/projects/PRJ-0002/predict", method="POST", token=token)
    assert status_code == 200
    assert data["project_id"] == "PRJ-0002"
    assert 0 <= data["risk_score"] <= 100


def test_what_if_endpoint(live_server):
    token = create_mock_jwt(user_id="5ad5e3f4-99ff-445b-bd5c-2fee103c357e", role="project_manager")
    payload = {
        "changes": {
            "compensation_pending_pct": 10.0,
            "litigation_cases": 0
        }
    }
    status_code, data = _http_request(
        f"{live_server}/projects/PRJ-0001/what-if",
        method="POST",
        token=token,
        json_data=payload
    )
    assert status_code == 200
    assert "current_score" in data
    assert "new_score" in data
    assert "change" in data
    assert data["change"] == data["new_score"] - data["current_score"]

    # Unauthorized PM should be forbidden (403)
    unauthorized_pm = create_mock_jwt(user_id="unauthorized_pm_uuid", role="project_manager")
    status_unauth, _ = _http_request(
        f"{live_server}/projects/PRJ-0001/what-if",
        method="POST",
        token=unauthorized_pm,
        json_data=payload
    )
    assert status_unauth == 403


def test_collector_district_boundary_enforced(live_server):
    # PRJ-0001 is in Pune. Collector for Thane should be forbidden (403)
    thane_token = create_mock_jwt(user_id="col_thane", role="collector", district="Thane")
    status_code, _ = _http_request(f"{live_server}/projects/PRJ-0001/prediction", token=thane_token)
    assert status_code == 403

    # Collector for Pune should succeed (200)
    pune_token = create_mock_jwt(user_id="col_pune", role="collector", district="Pune")
    status_code, _ = _http_request(f"{live_server}/projects/PRJ-0001/prediction", token=pune_token)
    assert status_code == 200


def test_auditor_prediction_read_allowed_predict_forbidden(live_server):
    auditor_token = create_mock_jwt(user_id="aud_1", role="auditor")

    # Auditor GET /prediction is allowed per Section 5 ("prediction only")
    status_get, data_get = _http_request(f"{live_server}/projects/PRJ-0001/prediction", token=auditor_token)
    assert status_get == 200

    # Auditor POST /predict is forbidden (403)
    status_post, _ = _http_request(f"{live_server}/projects/PRJ-0001/predict", method="POST", token=auditor_token)
    assert status_post == 403

    # Auditor POST /what-if is forbidden (403)
    status_whatif, _ = _http_request(
        f"{live_server}/projects/PRJ-0001/what-if",
        method="POST",
        token=auditor_token,
        json_data={"changes": {"litigation_cases": 0}}
    )
    assert status_whatif == 403
