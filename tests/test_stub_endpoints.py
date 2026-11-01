import sys
import os
from pathlib import Path

# Add backend directory to path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import pytest
from dotenv import load_dotenv

env_path = backend_path / ".env"
load_dotenv(dotenv_path=env_path)

if os.getenv("STUB_MODE", "false").lower() not in ("true", "1"):
    pytest.skip("STUB_MODE is disabled; real endpoint tests run in test_projects, test_prediction_service, test_a9_routers, test_admin", allow_module_level=True)
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["stub_mode"] is True

def test_me():
    res = client.get("/me")
    assert res.status_code == 200
    data = res.json()
    assert "user_id" in data
    assert "role" in data
    assert "full_name" in data

def test_projects_list():
    res = client.get("/projects")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    # Verify contract shape: {project_id, name, district, type, current_stage, risk_score, band, top_driver}
    item = data[0]
    for key in ["project_id", "name", "district", "type", "current_stage", "risk_score", "band", "top_driver"]:
        assert key in item

def test_projects_filters():
    res = client.get("/projects?district=Pune&band=High")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    for p in data:
        assert p["district"].lower() == "pune"
        assert p["band"] == "High"

def test_project_detail():
    res = client.get("/projects/PRJ-0001")
    assert res.status_code == 200
    data = res.json()
    for key in ["project", "parcels", "cases", "approvals", "compensation"]:
        assert key in data
    assert data["project"]["project_id"] == "PRJ-0001"

def test_project_create():
    payload = {
        "project": {
            "name": "Test Highway Corridor",
            "type": "highway",
            "agency": "NHAI",
            "state": "Maharashtra",
            "district": "Pune"
        },
        "parcels": [],
        "approvals": []
    }
    res = client.post("/projects", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "project_id" in data

def test_project_approve():
    res = client.post("/projects/PRJ-0001/approve")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "approved"

def test_project_patch():
    payload = {
        "project": {"officer_response_days": 10}
    }
    res = client.patch("/projects/PRJ-0001", json=payload)
    assert res.status_code == 200
    data = res.json()
    # Contract section 4 prediction object
    assert "risk_score" in data
    assert "band" in data
    assert "drivers" in data
    assert len(data["drivers"]) == 3
    assert "recommendations" in data

def test_prediction_endpoints():
    res1 = client.get("/projects/PRJ-0001/prediction")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["project_id"] == "PRJ-0001"
    assert "stage_probabilities" in data1
    assert "drivers" in data1

    res2 = client.post("/projects/PRJ-0001/predict")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["project_id"] == "PRJ-0001"

def test_what_if():
    payload = {
        "changes": {
            "litigation_cases": 0,
            "compensation_pending_pct": 15.0
        }
    }
    res = client.post("/projects/PRJ-0001/what-if", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "current_score" in data
    assert "new_score" in data
    assert "change" in data

def test_dashboard():
    res_summary = client.get("/dashboard/summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert "total_projects" in summary
    assert "band_distribution" in summary
    assert "top_risk" in summary

    res_dist = client.get("/dashboard/districts")
    assert res_dist.status_code == 200
    assert isinstance(res_dist.json(), list)

    res_trend = client.get("/dashboard/trend")
    assert res_trend.status_code == 200
    assert isinstance(res_trend.json(), list)

def test_map():
    res = client.get("/map/projects?district=Pune")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        assert "lat" in data[0]
        assert "lon" in data[0]
        assert "risk_score" in data[0]

def test_alerts():
    res = client.get("/alerts")
    assert res.status_code == 200
    alerts = res.json()
    assert isinstance(alerts, list)

    res_ack = client.post("/alerts/ALT-0001/ack")
    assert res_ack.status_code == 200
    assert res_ack.json()["status"] == "ack"

def test_tasks():
    post_res = client.post("/tasks", json={
        "project_id": "PRJ-0001",
        "assigned_to": "pm1",
        "action": "Coordinate with legal officer",
        "deadline": "2026-11-20"
    })
    assert post_res.status_code == 201
    assert "task_id" in post_res.json()

    get_res = client.get("/tasks")
    assert get_res.status_code == 200
    assert isinstance(get_res.json(), list)

    patch_res = client.patch("/tasks/TSK-0001", json={"status": "done"})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "done"

def test_admin():
    # Multipart CSV upload
    files = {"file": ("test.csv", b"project_id,planned_start\nPRJ-001,2026-01-01", "text/csv")}
    upload_res = client.post("/admin/upload", files=files)
    assert upload_res.status_code == 200
    assert "columns" in upload_res.json()

    # Retrain
    retrain_res = client.post("/admin/retrain", json={"file": "retrain_dataset.csv"})
    assert retrain_res.status_code == 202

    # Status
    status_res = client.get("/admin/retrain/status")
    assert status_res.status_code == 200
    assert status_res.json()["state"] == "done"

    # Models
    models_res = client.get("/admin/models")
    assert models_res.status_code == 200
    assert isinstance(models_res.json(), list)

    # Activate
    act_res = client.post("/admin/models/v1/activate")
    assert act_res.status_code == 200
    assert act_res.json()["status"] == "activated"

def test_audit():
    res = client.get("/audit")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        assert "log_id" in data[0]
        assert "action" in data[0]

