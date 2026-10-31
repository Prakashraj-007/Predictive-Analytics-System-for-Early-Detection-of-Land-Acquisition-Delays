"""
Tests for LandSentinel Authentication, RBAC, and Audit Helper (A5)
Covers 401 Unauthorized, 403 Forbidden, role enforcement, and valid calls.
"""
import sys
import time
import json
import urllib.request
import subprocess
from pathlib import Path
from datetime import timedelta
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.auth import (
    CurrentUser,
    get_current_user,
    require_roles,
    scope_projects_query,
    create_mock_jwt,
    get_jwt_secret
)
from app.services.audit import log_action

# ---------------------------------------------------------------------------
# Unit Tests for Auth Dependencies
# ---------------------------------------------------------------------------

def test_missing_token_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(None)
    assert exc_info.value.status_code == 401
    assert "Missing Authorization header" in exc_info.value.detail

def test_invalid_signature_raises_401():
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.payload")
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(creds)
    assert exc_info.value.status_code == 401
    assert "Invalid authentication token" in exc_info.value.detail

def test_expired_token_raises_401():
    expired_token = create_mock_jwt(
        user_id="5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        expires_in_hours=-1
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(creds)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()

def test_require_roles_forbidden_raises_403():
    auditor = CurrentUser(user_id="auditor1", role="auditor", full_name="Auditor One")
    checker = require_roles("admin")
    with pytest.raises(HTTPException) as exc_info:
        checker(auditor)
    assert exc_info.value.status_code == 403
    assert "Access forbidden" in exc_info.value.detail

def test_require_roles_allowed_returns_user():
    pm = CurrentUser(user_id="pm1", role="project_manager", district="Pune", full_name="Priya")
    checker = require_roles("project_manager", "collector")
    result = checker(pm)
    assert result.user_id == "pm1"
    assert result.role == "project_manager"

def test_scope_projects_query_pm():
    pm = CurrentUser(user_id="pm1", role="project_manager", full_name="PM")
    scope = scope_projects_query(pm)
    assert scope == {"created_by": "pm1"}

def test_scope_projects_query_collector():
    collector = CurrentUser(user_id="c1", role="collector", district="Pune", full_name="Collector")
    scope = scope_projects_query(collector)
    assert scope == {"district": "Pune"}

def test_scope_projects_query_statewide():
    for role in ["policymaker", "admin", "auditor"]:
        user = CurrentUser(user_id=f"{role}1", role=role, full_name="Official")
        scope = scope_projects_query(user)
        assert scope == {}

def test_audit_log_action_helper():
    res = log_action("pm1", "UPDATE_PROJECT", project_id="PRJ-0001", details={"speed": "fast"})
    assert res["user_id"] == "pm1"
    assert res["action"] == "UPDATE_PROJECT"
    assert res["project_id"] == "PRJ-0001"
    assert "log_id" in res
    assert "timestamp" in res

# ---------------------------------------------------------------------------
# Integration Tests: End-to-end HTTP Auth & RBAC Verification
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def live_server():
    port = 8009
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

def test_http_401_without_token(live_server):
    req = urllib.request.Request(f"{live_server}/me")
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)
    assert exc_info.value.code == 401

def test_http_401_with_invalid_token(live_server):
    req = urllib.request.Request(
        f"{live_server}/me",
        headers={"Authorization": "Bearer bad.token.here"}
    )
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)
    assert exc_info.value.code == 401

def test_http_403_auditor_calling_retrain(live_server):
    auditor_token = create_mock_jwt("61c729eb-1349-4733-a712-63ea368359e4", role="auditor")
    req = urllib.request.Request(
        f"{live_server}/admin/retrain",
        data=json.dumps({"file": "test.csv"}).encode("utf-8"),
        headers={"Authorization": f"Bearer {auditor_token}", "Content-Type": "application/json"},
        method="POST"
    )
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)
    assert exc_info.value.code == 403

def test_http_403_pm_calling_approve(live_server):
    pm_token = create_mock_jwt("5ad5e3f4-99ff-445b-bd5c-2fee103c357e", role="project_manager")
    req = urllib.request.Request(
        f"{live_server}/projects/PRJ-0001/approve",
        headers={"Authorization": f"Bearer {pm_token}"},
        method="POST"
    )
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(req)
    assert exc_info.value.code == 403

def test_http_200_valid_pm_me(live_server):
    pm_token = create_mock_jwt(
        "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        role="project_manager",
        district="Pune",
        full_name="Priya Sharma (PM)"
    )
    req = urllib.request.Request(
        f"{live_server}/me",
        headers={"Authorization": f"Bearer {pm_token}"}
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        data = json.loads(res.read().decode("utf-8"))
        assert data["role"] == "project_manager"
        assert data["district"] == "Pune"

def test_http_200_valid_admin_audit(live_server):
    admin_token = create_mock_jwt("34b6811b-2523-4bc3-b6a4-794b4724715d", role="admin")
    req = urllib.request.Request(
        f"{live_server}/audit",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        data = json.loads(res.read().decode("utf-8"))
        assert isinstance(data, list)

def test_http_200_public_health(live_server):
    req = urllib.request.Request(f"{live_server}/health")
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        data = json.loads(res.read().decode("utf-8"))
        assert data["status"] == "ok"
