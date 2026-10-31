"""
Integration Tests for LandSentinel Projects & Parcels Endpoints (A7).
Tests GET /projects, GET /projects/{id}, POST /projects, POST /projects/{id}/approve,
and PATCH /projects/{id} with role permissions, anonymization, and prediction triggering.
"""
import sys
import uuid
import json
import time
import urllib.request
import subprocess
from pathlib import Path
import pytest

backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.auth import create_mock_jwt

# Test Tokens
PM_TOKEN = create_mock_jwt(
    "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
    role="project_manager",
    district="Pune",
    full_name="Priya Sharma (PM)"
)
COLLECTOR_PUNE_TOKEN = create_mock_jwt(
    "cc354e61-2574-49e8-a9ff-85e541a60084",
    role="collector",
    district="Pune",
    full_name="Rajesh Patil (Collector Pune)"
)
COLLECTOR_NAGPUR_TOKEN = create_mock_jwt(
    "nagpur-collector-uuid",
    role="collector",
    district="Nagpur",
    full_name="Collector Nagpur"
)
ADMIN_TOKEN = create_mock_jwt(
    "34b6811b-2523-4bc3-b6a4-794b4724715d",
    role="admin",
    full_name="Anand Verma (Admin)"
)


@pytest.fixture(scope="module")
def live_server():
    port = 8012
    proc = subprocess.Popen([
        sys.executable, "-m", "uvicorn", "app.main:app",
        "--port", str(port),
        "--app-dir", str(backend_path)
    ])
    time.sleep(2.5)
    base_url = f"http://127.0.0.1:{port}"
    yield base_url
    proc.terminate()
    proc.kill()


def test_list_projects_admin_sees_all(live_server):
    req = urllib.request.Request(
        f"{live_server}/projects",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        projects = json.loads(res.read().decode("utf-8"))
        assert isinstance(projects, list)
        assert len(projects) >= 5

        # Verify contract shape
        item = projects[0]
        for key in ["project_id", "name", "district", "type", "current_stage", "risk_score", "band", "top_driver"]:
            assert key in item


def test_list_projects_collector_scoped_to_district(live_server):
    req = urllib.request.Request(
        f"{live_server}/projects",
        headers={"Authorization": f"Bearer {COLLECTOR_PUNE_TOKEN}"}
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        projects = json.loads(res.read().decode("utf-8"))
        for p in projects:
            assert p["district"].lower() == "pune"


def test_list_projects_filtering_and_sorting(live_server):
    req = urllib.request.Request(
        f"{live_server}/projects?district=Pune&sort=risk_desc",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        projects = json.loads(res.read().decode("utf-8"))
        for p in projects:
            assert p["district"].lower() == "pune"

        scores = [p["risk_score"] for p in projects if p["risk_score"] is not None]
        assert scores == sorted(scores, reverse=True)


def test_get_project_detail_and_anonymisation(live_server):
    req = urllib.request.Request(
        f"{live_server}/projects/PRJ-0001",
        headers={"Authorization": f"Bearer {PM_TOKEN}"}
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        detail = json.loads(res.read().decode("utf-8"))

        for k in ["project", "parcels", "cases", "approvals", "compensation"]:
            assert k in detail

        # Verify parcel owner anonymisation (contracts.md section 1)
        for parcel in detail["parcels"]:
            assert "owner" not in parcel
            assert "owner_name" not in parcel


def test_get_project_detail_collector_boundary_check(live_server):
    # Nagpur collector trying to view Pune project (PRJ-0001 is in Pune)
    req = urllib.request.Request(
        f"{live_server}/projects/PRJ-0001",
        headers={"Authorization": f"Bearer {COLLECTOR_NAGPUR_TOKEN}"}
    )
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)
    assert exc_info.value.code == 403


def test_create_project_pm_draft_status(live_server):
    new_pid = f"PRJ-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "project": {
            "project_id": new_pid,
            "name": "Western Bypass Expressway",
            "type": "highway",
            "agency": "MSRDC",
            "state": "Maharashtra",
            "district": "Pune",
            "lat": 18.52,
            "lon": 73.85,
            "land_area_ha": 120.0,
            "families_affected": 80,
            "families_resettlement": 15,
            "budget": 500000000.0,
            "planned_start": "2026-01-01",
            "planned_end": "2028-01-01",
            "current_stage": "planning",
            "rr_progress_pct": 0.0,
            "officer_response_days": 10
        },
        "parcels": [
            {
                "parcel_id": f"PAR-{uuid.uuid4().hex[:6].upper()}",
                "survey_no": "201/1",
                "area_ha": 5.5,
                "land_type": "private",
                "compensation_status": "pending",
                "possession_status": "pending",
                "doc_complete": True,
                "ownership_dispute": False
            }
        ],
        "approvals": [
            {
                "approval_id": f"APP-{uuid.uuid4().hex[:6].upper()}",
                "name": "Forest Clearance",
                "planned_date": "2026-06-01",
                "status": "pending"
            }
        ]
    }
    req = urllib.request.Request(
        f"{live_server}/projects",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {PM_TOKEN}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 201
        data = json.loads(res.read().decode("utf-8"))
        assert data["project_id"] == new_pid

    # Verify audit log via GET /audit API
    audit_req = urllib.request.Request(
        f"{live_server}/audit?project={new_pid}",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    with urllib.request.urlopen(audit_req) as audit_res:
        assert audit_res.status == 200
        logs = json.loads(audit_res.read().decode("utf-8"))
        assert any(log.get("action") == "CREATE_PROJECT" for log in logs)


def test_create_project_forbidden_for_non_pm(live_server):
    payload = {
        "project": {"name": "Test Project", "district": "Pune"},
        "parcels": [],
        "approvals": []
    }
    req = urllib.request.Request(
        f"{live_server}/projects",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {COLLECTOR_PUNE_TOKEN}", "Content-Type": "application/json"},
        method="POST"
    )
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)
    assert exc_info.value.code == 403


def test_approve_project_collector_success(live_server):
    req = urllib.request.Request(
        f"{live_server}/projects/PRJ-0001/approve",
        headers={"Authorization": f"Bearer {COLLECTOR_PUNE_TOKEN}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        data = json.loads(res.read().decode("utf-8"))
        assert data["status"] == "active"
        assert "approved" in data["message"].lower()

    # Verify audit log via GET /audit API
    audit_req = urllib.request.Request(
        f"{live_server}/audit?project=PRJ-0001",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    with urllib.request.urlopen(audit_req) as audit_res:
        assert audit_res.status == 200
        logs = json.loads(audit_res.read().decode("utf-8"))
        assert any(log.get("action") == "APPROVE_PROJECT" for log in logs)


def test_approve_project_collector_wrong_district_forbidden(live_server):
    req = urllib.request.Request(
        f"{live_server}/projects/PRJ-0001/approve",
        headers={"Authorization": f"Bearer {COLLECTOR_NAGPUR_TOKEN}"},
        method="POST"
    )
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)
    assert exc_info.value.code == 403


def test_update_project_pm_triggers_prediction(live_server):
    payload = {
        "project": {
            "officer_response_days": 8,
            "rr_progress_pct": 45.0
        }
    }
    req = urllib.request.Request(
        f"{live_server}/projects/PRJ-0001",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {PM_TOKEN}", "Content-Type": "application/json"},
        method="PATCH"
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        pred = json.loads(res.read().decode("utf-8"))

        # Full prediction object verified per section 4
        assert pred["project_id"] == "PRJ-0001"
        assert "risk_score" in pred
        assert "band" in pred
        assert "delay_probability" in pred
        assert "expected_delay_days" in pred
        assert "stage_probabilities" in pred
        assert "drivers" in pred
        assert len(pred["drivers"]) == 3
        assert "recommendations" in pred

    # Verify audit log via GET /audit API
    audit_req = urllib.request.Request(
        f"{live_server}/audit?project=PRJ-0001",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    with urllib.request.urlopen(audit_req) as audit_res:
        assert audit_res.status == 200
        logs = json.loads(audit_res.read().decode("utf-8"))
        assert any(log.get("action") == "UPDATE_PROJECT" for log in logs)
