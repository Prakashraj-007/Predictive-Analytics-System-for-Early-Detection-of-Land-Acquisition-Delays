"""
Integration Tests for Task A10: Admin Dataset Upload, Retraining, Model Versioning & Activation.
Validates multipart validation, 422 error schemas, background task dispatch, and admin-only RBAC guards.

Strictly adheres to docs/contracts.md sections 3, 5, 6, and A10 specs.
"""
import pytest
import os
import json
import urllib.request
import urllib.error
import subprocess
import sys
import time
import uuid
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.auth import create_mock_jwt

VALID_22_COLUMNS = [
    "project_id", "planned_start", "land_area_ha", "families_affected", "project_type",
    "litigation_cases", "stay_orders", "ownership_disputes", "compensation_pending_pct",
    "approval_days_pending", "docs_incomplete_pct", "officer_response_days",
    "encroached_area_pct", "possession_pct", "rr_progress_pct", "current_stage",
    "district_past_delay_rate", "is_delayed", "delay_days", "delayed_approval",
    "delayed_compensation", "delayed_possession"
]


@pytest.fixture(scope="module")
def live_server():
    server_port = 8013
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
        raise RuntimeError("Live uvicorn server failed to start for test_admin")

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


def _upload_multipart_csv(url: str, filename: str, content: bytes, token: str) -> tuple[int, dict]:
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(b"Content-Type: text/csv\r\n\r\n")
    body.extend(content)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": f"Bearer {token}"
    }

    req = urllib.request.Request(url, data=bytes(body), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return resp.status, data
    except urllib.error.HTTPError as he:
        err_body = {}
        try:
            err_body = json.loads(he.read().decode("utf-8"))
        except Exception:
            pass
        return he.code, err_body


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

def test_admin_upload_valid_csv(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    
    # Construct a valid CSV row matching all 22 required columns
    csv_header = ",".join(VALID_22_COLUMNS) + "\n"
    csv_row = "PRJ-TEST,2026-01-01,100,50,highway,2,0,1,25.0,30,10.0,14,0.0,75.0,50.0,award,0.25,1,45,0,1,0\n"
    csv_bytes = (csv_header + csv_row).encode("utf-8")

    status, data = _upload_multipart_csv(
        f"{live_server}/admin/upload",
        filename="test_train.csv",
        content=csv_bytes,
        token=admin_token
    )
    assert status == 200
    assert "filename" in data
    assert data["rows"] == 1
    assert len(data["columns"]) == 22


def test_admin_upload_missing_columns_returns_422(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    
    # Incomplete CSV missing half the columns
    invalid_csv = "project_id,land_area_ha,project_type\nPRJ-01,50.0,highway\n".encode("utf-8")
    status, data = _upload_multipart_csv(
        f"{live_server}/admin/upload",
        filename="bad.csv",
        content=invalid_csv,
        token=admin_token
    )
    assert status == 422
    assert "Missing" in data.get("detail", "")


def test_admin_upload_forbidden_for_non_admin(live_server):
    pm_token = create_mock_jwt(user_id="pm_1", role="project_manager")
    csv_bytes = (",".join(VALID_22_COLUMNS) + "\n").encode("utf-8")
    status, _ = _upload_multipart_csv(
        f"{live_server}/admin/upload",
        filename="test.csv",
        content=csv_bytes,
        token=pm_token
    )
    assert status == 403


def test_admin_trigger_retrain_and_status(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")
    payload = {"file": "historical_projects.csv"}
    
    # 1. Trigger retrain
    status_retrain, data_retrain = _http_request(
        f"{live_server}/admin/retrain",
        method="POST",
        token=admin_token,
        json_data=payload
    )
    assert status_retrain == 202
    assert "message" in data_retrain

    # 2. Check retrain status
    status_check, data_status = _http_request(f"{live_server}/admin/retrain/status", token=admin_token)
    assert status_check == 200
    assert data_status["state"] in ("running", "done")
    if data_status.get("result"):
        assert "before" in data_status["result"]
        assert "after" in data_status["result"]
        assert "new_version" in data_status["result"]


def test_admin_list_and_activate_models(live_server):
    admin_token = create_mock_jwt(user_id="admin_1", role="admin")

    # 1. List models
    status_list, models = _http_request(f"{live_server}/admin/models", token=admin_token)
    assert status_list == 200
    assert isinstance(models, list)
    assert len(models) >= 1
    v1 = models[0]
    assert "version" in v1
    assert "metrics" in v1
    assert "is_active" in v1

    # 2. Activate model version
    target_version = v1["version"]
    status_act, data_act = _http_request(
        f"{live_server}/admin/models/{target_version}/activate",
        method="POST",
        token=admin_token
    )
    assert status_act == 200
    assert data_act["status"] == "activated"
    assert data_act["version"] == target_version


def test_admin_endpoints_forbidden_for_auditor_and_collector(live_server):
    auditor_token = create_mock_jwt(user_id="aud_1", role="auditor")
    collector_token = create_mock_jwt(user_id="col_1", role="collector", district="Pune")

    for token in (auditor_token, collector_token):
        s1, _ = _http_request(f"{live_server}/admin/models", token=token)
        assert s1 == 403

        s2, _ = _http_request(f"{live_server}/admin/retrain", method="POST", token=token, json_data={"file": "test.csv"})
        assert s2 == 403

        s3, _ = _http_request(f"{live_server}/admin/retrain/status", token=token)
        assert s3 == 403
