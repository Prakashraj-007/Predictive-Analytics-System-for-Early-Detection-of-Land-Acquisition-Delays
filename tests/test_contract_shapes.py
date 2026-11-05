"""
tests/test_contract_shapes.py
==============================
API Contract Shape and Route Conformance Tests (Task D10).
Loads the FastAPI application in STUB_MODE and asserts:
  1. Every REST endpoint declared in Section 3 of docs/contracts.md exists in the FastAPI app.
  2. Every endpoint returns the exact top-level keys documented in docs/contracts.md.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))
sys.path.insert(0, str(REPO_ROOT))

# Force STUB_MODE and avoid external Supabase roundtrips in unit contract tests
os.environ["STUB_MODE"] = "true"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["SUPABASE_JWT_SECRET"] = os.environ.get(
    "SUPABASE_JWT_SECRET", "contract-testing-secret-key-with-minimum-32-chars-length"
)

# Reset cached client in db module if already initialized
try:
    import app.db as db_mod
    db_mod._supabase_client = None
except Exception:
    pass

from starlette.testclient import TestClient
from app.main import app
from app.auth import create_mock_jwt

# Canonical prediction shape keys (Section 4)
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


def parse_contract_endpoints(contracts_path: Path) -> list[tuple[str, str]]:
    """
    Parses Section 3 of docs/contracts.md and extracts all (HTTP_METHOD, PATH_TEMPLATE) tuples.
    """
    content = contracts_path.read_text(encoding="utf-8")
    section_3 = content.split("## 3. REST endpoints")[1].split("## 4. Prediction object")[0]
    
    # Matches: GET  /health, POST /projects/{id}/approve, etc.
    pattern = re.compile(r"^(GET|POST|PATCH|DELETE)\s+([^\s\?]+)", re.MULTILINE)
    endpoints = pattern.findall(section_3)
    return [(method.upper(), path) for method, path in endpoints]


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="module")
def auth_headers() -> dict[str, dict[str, str]]:
    """Generate valid test JWT headers for each system role."""
    roles = {
        "admin": ("34b6811b-2523-4bc3-b6a4-794b4724715d", None),
        "project_manager": ("5ad5e3f4-99ff-445b-bd5c-2fee103c357e", "Pune"),
        "collector": ("cc354e61-2574-49e8-a9ff-85e541a60084", "Pune"),
        "policymaker": ("52430ba3-8c1d-4807-9b96-873adac3b96b", None),
        "auditor": ("61c729eb-1349-4733-a712-63ea368359e4", None),
    }
    headers = {}
    for role, (user_id, district) in roles.items():
        token = create_mock_jwt(user_id=user_id, role=role, district=district)
        headers[role] = {"Authorization": f"Bearer {token}"}
    return headers


# -----------------------------------------------------------------------------
# 1. Contract Route Existence Verification
# -----------------------------------------------------------------------------
def test_all_contract_endpoints_exist_in_fastapi_app():
    """
    Verifies that every endpoint specified in docs/contracts.md Section 3
    is registered on the FastAPI application router.
    """
    contracts_file = REPO_ROOT / "docs" / "contracts.md"
    assert contracts_file.exists(), "docs/contracts.md must exist"

    contract_endpoints = parse_contract_endpoints(contracts_file)
    assert len(contract_endpoints) >= 20, f"Expected at least 20 endpoints in contract, got {len(contract_endpoints)}"

    app_routes: set[tuple[str, str]] = set()
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            for m in route.methods:
                if m not in ("HEAD", "OPTIONS"):
                    app_routes.add((m.upper(), route.path))

    for method, path in contract_endpoints:
        # Standardize parameter formatting e.g. {id} or {version}
        matched = (method, path) in app_routes
        assert matched, f"Contract endpoint {method} {path} not found in FastAPI app routes: {app_routes}"


# -----------------------------------------------------------------------------
# 2. Endpoint Top-Level Keys Verification
# -----------------------------------------------------------------------------

def test_shape_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert {"status", "service", "stub_mode"}.issubset(set(data.keys()))


def test_shape_me(client, auth_headers):
    res = client.get("/me", headers=auth_headers["admin"])
    assert res.status_code == 200
    data = res.json()
    assert {"user_id", "full_name", "role", "district"}.issubset(set(data.keys()))


def test_shape_projects_list(client, auth_headers):
    res = client.get("/projects", headers=auth_headers["policymaker"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    item = data[0]
    expected_keys = {
        "project_id", "name", "district", "type",
        "current_stage", "risk_score", "band", "top_driver"
    }
    assert expected_keys.issubset(set(item.keys()))


def test_shape_project_detail(client, auth_headers):
    res = client.get("/projects/PRJ-0001", headers=auth_headers["policymaker"])
    assert res.status_code == 200
    data = res.json()
    expected_keys = {"project", "parcels", "cases", "approvals", "compensation"}
    assert expected_keys.issubset(set(data.keys()))
    assert data["project"]["project_id"] == "PRJ-0001"
    assert isinstance(data["parcels"], list)
    assert isinstance(data["cases"], list)
    assert isinstance(data["approvals"], list)
    assert isinstance(data["compensation"], dict)


def test_shape_project_create(client, auth_headers):
    payload = {
        "project": {
            "name": "Nagpur Outer Ring Road Section 3",
            "type": "highway",
            "agency": "NHAI",
            "state": "Maharashtra",
            "district": "Pune",
            "planned_start": "2026-01-01",
            "planned_end": "2028-12-31",
            "land_area_ha": 150.0,
            "budget": 500000000.0,
        },
        "parcels": [],
        "approvals": [],
    }
    res = client.post("/projects", json=payload, headers=auth_headers["project_manager"])
    assert res.status_code == 201
    data = res.json()
    assert "project_id" in data


def test_shape_project_approve(client, auth_headers):
    res = client.post("/projects/PRJ-0001/approve", headers=auth_headers["collector"])
    assert res.status_code == 200
    data = res.json()
    assert "status" in data


def test_shape_project_patch(client, auth_headers):
    payload = {
        "project": {"officer_response_days": 12, "rr_progress_pct": 45.0}
    }
    res = client.patch("/projects/PRJ-0001", json=payload, headers=auth_headers["project_manager"])
    assert res.status_code == 200
    data = res.json()
    # Contract says PATCH /projects/{id} returns full prediction object (Section 4)
    assert CONTRACT_PREDICTION_KEYS.issubset(set(data.keys()))


def test_shape_project_prediction_get(client, auth_headers):
    res = client.get("/projects/PRJ-0001/prediction", headers=auth_headers["policymaker"])
    assert res.status_code == 200
    data = res.json()
    assert CONTRACT_PREDICTION_KEYS.issubset(set(data.keys()))
    assert len(data["drivers"]) == 3
    assert len(data["recommendations"]) <= 3


def test_shape_project_predict_post(client, auth_headers):
    res = client.post("/projects/PRJ-0001/predict", headers=auth_headers["policymaker"])
    assert res.status_code == 200
    data = res.json()
    assert CONTRACT_PREDICTION_KEYS.issubset(set(data.keys()))


def test_shape_project_what_if(client, auth_headers):
    payload = {
        "changes": {
            "litigation_cases": 2,
            "compensation_pending_pct": 10.0,
        }
    }
    res = client.post("/projects/PRJ-0001/what-if", json=payload, headers=auth_headers["policymaker"])
    assert res.status_code == 200
    data = res.json()
    assert {"current_score", "new_score", "change"}.issubset(set(data.keys()))


def test_shape_dashboard_summary(client, auth_headers):
    res = client.get("/dashboard/summary", headers=auth_headers["policymaker"])
    assert res.status_code == 200
    data = res.json()
    expected_keys = {
        "total_projects", "high_risk_projects", "avg_risk_score",
        "projects_with_alerts", "band_distribution", "top_risk"
    }
    assert expected_keys.issubset(set(data.keys()))
    assert {"Low", "Medium", "High"}.issubset(set(data["band_distribution"].keys()))
    assert isinstance(data["top_risk"], list)


def test_shape_dashboard_districts(client, auth_headers):
    res = client.get("/dashboard/districts", headers=auth_headers["policymaker"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        assert {"district", "avg_risk", "project_count", "high_risk_count"}.issubset(set(data[0].keys()))


def test_shape_dashboard_trend(client, auth_headers):
    res = client.get("/dashboard/trend", headers=auth_headers["policymaker"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        assert {"month", "avg_risk"}.issubset(set(data[0].keys()))


def test_shape_map_projects(client, auth_headers):
    res = client.get("/map/projects", headers=auth_headers["policymaker"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        expected_keys = {"project_id", "name", "lat", "lon", "risk_score", "band", "top_driver"}
        assert expected_keys.issubset(set(data[0].keys()))


def test_shape_alerts_list(client, auth_headers):
    res = client.get("/alerts", headers=auth_headers["collector"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        expected_keys = {
            "alert_id", "project_id", "project_name", "district",
            "reason", "risk_score", "previous_score", "status", "created_at"
        }
        assert expected_keys.issubset(set(data[0].keys()))


def test_shape_alert_ack(client, auth_headers):
    res = client.post("/alerts/ALT-0001/ack", headers=auth_headers["collector"])
    assert res.status_code == 200
    data = res.json()
    assert "status" in data


def test_shape_tasks_post(client, auth_headers):
    payload = {
        "project_id": "PRJ-0001",
        "assigned_to": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "action": "Convene coordination committee for forest land clearance",
        "deadline": "2026-12-15",
    }
    res = client.post("/tasks", json=payload, headers=auth_headers["collector"])
    assert res.status_code == 201
    data = res.json()
    assert "task_id" in data


def test_shape_tasks_get(client, auth_headers):
    res = client.get("/tasks", headers=auth_headers["project_manager"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        expected_keys = {
            "task_id", "project_id", "project_name", "action",
            "assigned_by", "assigned_to", "deadline", "status", "remarks"
        }
        assert expected_keys.issubset(set(data[0].keys()))


def test_shape_tasks_patch(client, auth_headers):
    payload = {"status": "done", "remarks": "Clearance documents verified by nodal team"}
    res = client.patch("/tasks/TSK-0001", json=payload, headers=auth_headers["project_manager"])
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") == "done"


def test_shape_admin_upload(client, auth_headers):
    files = {"file": ("training_data.csv", b"project_id,planned_start\nPRJ-01,2026-01-01\n", "text/csv")}
    res = client.post("/admin/upload", files=files, headers=auth_headers["admin"])
    assert res.status_code == 200
    data = res.json()
    assert {"filename", "rows", "columns"}.issubset(set(data.keys()))


def test_shape_admin_retrain(client, auth_headers):
    payload = {"file": "retrain_dataset.csv"}
    res = client.post("/admin/retrain", json=payload, headers=auth_headers["admin"])
    assert res.status_code == 202


def test_shape_admin_retrain_status(client, auth_headers):
    res = client.get("/admin/retrain/status", headers=auth_headers["admin"])
    assert res.status_code == 200
    data = res.json()
    assert "state" in data
    assert data["state"] in ("running", "done", "failed")


def test_shape_admin_models(client, auth_headers):
    res = client.get("/admin/models", headers=auth_headers["admin"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        assert {"version", "trained_at", "metrics", "is_active"}.issubset(set(data[0].keys()))


def test_shape_admin_model_activate(client, auth_headers):
    res = client.post("/admin/models/v1/activate", headers=auth_headers["admin"])
    assert res.status_code == 200
    data = res.json()
    assert "status" in data


def test_shape_audit(client, auth_headers):
    res = client.get("/audit", headers=auth_headers["admin"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        item = data[0]
        # Contract Section 3 specifies: log_id, user, action, project_id, timestamp
        assert "log_id" in item
        assert "action" in item
        assert "project_id" in item
        assert "timestamp" in item
        assert ("user" in item or "user_id" in item)

