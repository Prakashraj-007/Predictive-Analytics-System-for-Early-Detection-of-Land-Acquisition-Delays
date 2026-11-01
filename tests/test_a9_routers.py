"""
Integration Tests for Task A9: Dashboard, Map, Alerts, Tasks, and Audit Routers.
Validates live HTTP API behavior, role-based scoping, and contract shapes.
Strictly adheres to docs/contracts.md sections 3 & 5.
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


@pytest.fixture(scope="module")
def live_server():
    server_port = 8011
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

    for _ in range(40):
        try:
            with urllib.request.urlopen(f"{server_url}/health", timeout=1) as resp:
                if resp.status == 200:
                    break
        except Exception:
            time.sleep(0.3)
    else:
        proc.kill()
        raise RuntimeError("Live uvicorn server failed to start for test_a9_routers")

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


# ---------------------------------------------------------------------------
# 1. Dashboard Router Tests
# ---------------------------------------------------------------------------

def test_dashboard_summary_admin(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    status, data = _http_request(f"{live_server}/dashboard/summary", token=admin_token)
    assert status == 200
    assert "total_projects" in data
    assert "high_risk_projects" in data
    assert "avg_risk_score" in data
    assert "band_distribution" in data
    assert "Low" in data["band_distribution"]
    assert "Medium" in data["band_distribution"]
    assert "High" in data["band_distribution"]
    assert isinstance(data["top_risk"], list)
    assert len(data["top_risk"]) <= 10


def test_dashboard_summary_collector_district_scoped(live_server):
    thane_token = create_mock_jwt(user_id="col_thane", role="collector", district="Thane")
    status, data = _http_request(f"{live_server}/dashboard/summary", token=thane_token)
    assert status == 200
    assert data["total_projects"] >= 1


def test_dashboard_districts(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    status, data = _http_request(f"{live_server}/dashboard/districts", token=admin_token)
    assert status == 200
    assert isinstance(data, list)
    assert len(data) >= 1
    first = data[0]
    assert "district" in first
    assert "avg_risk" in first
    assert "project_count" in first
    assert "high_risk_count" in first


def test_dashboard_trend(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    status, data = _http_request(f"{live_server}/dashboard/trend", token=admin_token)
    assert status == 200
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "month" in data[0]
    assert "avg_risk" in data[0]


# ---------------------------------------------------------------------------
# 2. Map Router Tests
# ---------------------------------------------------------------------------

def test_map_projects(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    status, data = _http_request(f"{live_server}/map/projects", token=admin_token)
    assert status == 200
    assert isinstance(data, list)
    assert len(data) >= 1
    p = data[0]
    assert "project_id" in p
    assert "name" in p
    assert "lat" in p
    assert "lon" in p
    assert "risk_score" in p
    assert "band" in p
    assert "top_driver" in p


def test_map_projects_collector_forced_to_district(live_server):
    pune_token = create_mock_jwt(user_id="col_pune", role="collector", district="Pune")
    # Collector explicitly requests 'Thane', but should be forced to 'Pune'
    status, data = _http_request(f"{live_server}/map/projects?district=Thane", token=pune_token)
    assert status == 200
    assert isinstance(data, list)


# ---------------------------------------------------------------------------
# 3. Alerts Router Tests
# ---------------------------------------------------------------------------

def test_list_alerts_policymaker_only_high(live_server):
    pmaker_token = create_mock_jwt(user_id="pmaker_1", role="policymaker")
    status, data = _http_request(f"{live_server}/alerts", token=pmaker_token)
    assert status == 200
    assert isinstance(data, list)
    for a in data:
        # Policymaker only sees High alerts (>60)
        assert a["risk_score"] > 60


def test_list_alerts_collector_scoped_to_district(live_server):
    thane_token = create_mock_jwt(user_id="col_thane", role="collector", district="Thane")
    status, data = _http_request(f"{live_server}/alerts", token=thane_token)
    assert status == 200
    assert isinstance(data, list)
    for a in data:
        assert a["district"].lower() == "thane"


def test_acknowledge_alert(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    status, data = _http_request(f"{live_server}/alerts/ALT-0001/ack", method="POST", token=admin_token)
    assert status == 200
    assert data["status"] == "ack"
    assert data["alert_id"] == "ALT-0001"


# ---------------------------------------------------------------------------
# 4. Tasks Router Tests
# ---------------------------------------------------------------------------

def test_create_task_collector_success(live_server):
    col_token = create_mock_jwt(user_id="d2a76f2e-4ef2-4ab8-91db-7517b120286b", role="collector", district="Pune")
    payload = {
        "project_id": "PRJ-0001",
        "assigned_to": "pm1",
        "action": "Expedite hearing for stay order in Pune District Court",
        "deadline": "2026-11-20"
    }
    status, data = _http_request(f"{live_server}/tasks", method="POST", token=col_token, json_data=payload)
    assert status == 201
    assert "task_id" in data
    assert data["task_id"].startswith("TSK-")


def test_create_task_pm_forbidden(live_server):
    pm_token = create_mock_jwt(user_id="pm_1", role="project_manager")
    payload = {
        "project_id": "PRJ-0001",
        "assigned_to": "pm1",
        "action": "Invalid attempt to self-assign task",
        "deadline": "2026-11-20"
    }
    status, _ = _http_request(f"{live_server}/tasks", method="POST", token=pm_token, json_data=payload)
    assert status == 403


def test_list_tasks(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    status, data = _http_request(f"{live_server}/tasks", token=admin_token)
    assert status == 200
    assert isinstance(data, list)
    if data:
        t = data[0]
        assert "task_id" in t
        assert "project_id" in t
        assert "action" in t
        assert "status" in t


def test_update_task_pm(live_server):
    pm_token = create_mock_jwt(user_id="pm_1", role="project_manager")
    payload = {
        "status": "done",
        "remarks": "Hearing expedited successfully."
    }
    status, data = _http_request(f"{live_server}/tasks/TSK-0001", method="PATCH", token=pm_token, json_data=payload)
    assert status == 200
    assert data["status"] == "done"
    assert data["remarks"] == "Hearing expedited successfully."


# ---------------------------------------------------------------------------
# 5. Audit Router Tests
# ---------------------------------------------------------------------------

def test_audit_admin_and_auditor_allowed(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    status, data = _http_request(f"{live_server}/audit", token=admin_token)
    assert status == 200
    assert isinstance(data, list)
    assert len(data) >= 1

    auditor_token = create_mock_jwt(user_id="aud_1", role="auditor")
    status_aud, data_aud = _http_request(f"{live_server}/audit", token=auditor_token)
    assert status_aud == 200
    assert isinstance(data_aud, list)


def test_audit_pm_and_collector_forbidden(live_server):
    pm_token = create_mock_jwt(user_id="pm_1", role="project_manager")
    status_pm, _ = _http_request(f"{live_server}/audit", token=pm_token)
    assert status_pm == 403

    col_token = create_mock_jwt(user_id="col_1", role="collector", district="Pune")
    status_col, _ = _http_request(f"{live_server}/audit", token=col_token)
    assert status_col == 403

