"""
Authentication and Role-Based Access Control (RBAC) for LandSentinel.
Verifies Supabase JWTs, loads user profile records, enforces role guards,
and provides query scoping helpers.
Strictly adheres to docs/contracts.md section 1, 2, 3, & 5.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from pathlib import Path
from dotenv import load_dotenv
import jwt
from pydantic import BaseModel
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.db import get_supabase_client

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

security = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class CurrentUser(BaseModel):
    user_id: str
    role: str
    district: Optional[str] = None
    full_name: str
    email: Optional[str] = None

# Known demo user profile fallbacks for rapid testing / offline stub mode
DEMO_PROFILES: Dict[str, Dict[str, Any]] = {
    "5ad5e3f4-99ff-445b-bd5c-2fee103c357e": {
        "user_id": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
        "role": "project_manager",
        "district": "Pune",
        "full_name": "Priya Sharma (PM)",
        "email": "pm1@landsentinel.gov.in"
    },
    "cc354e61-2574-49e8-a9ff-85e541a60084": {
        "user_id": "cc354e61-2574-49e8-a9ff-85e541a60084",
        "role": "collector",
        "district": "Pune",
        "full_name": "Rajesh Patil (District Collector)",
        "email": "collector1@landsentinel.gov.in"
    },
    "52430ba3-8c1d-4807-9b96-873adac3b96b": {
        "user_id": "52430ba3-8c1d-4807-9b96-873adac3b96b",
        "role": "policymaker",
        "district": None,
        "full_name": "Dr. Sunita Deshmukh (Secretary)",
        "email": "policymaker1@landsentinel.gov.in"
    },
    "34b6811b-2523-4bc3-b6a4-794b4724715d": {
        "user_id": "34b6811b-2523-4bc3-b6a4-794b4724715d",
        "role": "admin",
        "district": None,
        "full_name": "Anand Verma (System Admin)",
        "email": "admin1@landsentinel.gov.in"
    },
    "61c729eb-1349-4733-a712-63ea368359e4": {
        "user_id": "61c729eb-1349-4733-a712-63ea368359e4",
        "role": "auditor",
        "district": None,
        "full_name": "Kavita Rao (State Auditor)",
        "email": "auditor1@landsentinel.gov.in"
    }
}

_profile_cache: Dict[str, CurrentUser] = {}

def get_jwt_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET is not configured on the server."
        )
    return secret

# ---------------------------------------------------------------------------
# Token helper for tests and mock sessions
# ---------------------------------------------------------------------------
def create_mock_jwt(
    user_id: str,
    role: str = "project_manager",
    district: Optional[str] = None,
    full_name: Optional[str] = None,
    email: Optional[str] = None,
    expires_in_hours: int = 24
) -> str:
    """
    Creates a signed JWT matching the Supabase Auth HS256 schema for testing.
    """
    secret = get_jwt_secret()
    now = datetime.now(timezone.utc)
    payload = {
        "iss": "supabase",
        "sub": user_id,
        "role": "authenticated",
        "email": email or f"{user_id}@landsentinel.gov.in",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=expires_in_hours)).timestamp()),
        "user_metadata": {
            "role": role,
            "district": district,
            "full_name": full_name or user_id
        }
    }
    return jwt.encode(payload, secret, algorithm="HS256")

# ---------------------------------------------------------------------------
# Core Auth Dependencies
# ---------------------------------------------------------------------------
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> CurrentUser:
    """
    FastAPI dependency that extracts and cryptographically verifies the
    Supabase JWT from Authorization: Bearer <token>, then retrieves the user's
    profile (role, district, full_name).
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header or Bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    secret = get_jwt_secret()

    try:
        # Decode and verify HS256 signature and expiration
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = str(payload.get("sub") or payload.get("user_id") or "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing user identifier ('sub').",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 1. Check in-memory cache
    if user_id in _profile_cache:
        return _profile_cache[user_id]

    role: Optional[str] = None
    district: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = payload.get("email")

    # 2. Try fetching from Supabase public.profiles via service-role client
    supabase = get_supabase_client()
    if supabase:
        try:
            res = supabase.table("profiles").select("*").eq("user_id", user_id).execute()
            if res.data and len(res.data) > 0:
                p_row = res.data[0]
                role = p_row.get("role")
                district = p_row.get("district")
                full_name = p_row.get("full_name")
        except Exception as e:
            print(f"[WARN] Failed to query profiles table for {user_id}: {e}")

    # 3. Fallback to demo profile map
    if not role and user_id in DEMO_PROFILES:
        dp = DEMO_PROFILES[user_id]
        role = dp["role"]
        district = dp["district"]
        full_name = dp["full_name"]
        email = email or dp.get("email")

    # 4. Fallback to user_metadata encoded inside the JWT
    if not role:
        user_meta = payload.get("user_metadata", {})
        role = user_meta.get("role", "project_manager")
        district = user_meta.get("district")
        full_name = user_meta.get("full_name", user_id)

    current_user = CurrentUser(
        user_id=user_id,
        role=role,
        district=district,
        full_name=full_name or user_id,
        email=email
    )

    # Cache profile
    _profile_cache[user_id] = current_user
    return current_user

def require_roles(*roles: str):
    """
    Dependency factory returning a dependency that enforces allowed roles.
    Returns 403 Forbidden with a clear message if the user does not possess
    one of the specified roles.
    """
    def role_checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: role '{user.role}' is not authorized for this action. Required roles: {list(roles)}"
            )
        return user
    return role_checker

def scope_projects_query(user: CurrentUser) -> Dict[str, Any]:
    """
    Given a CurrentUser, returns the filter criteria to scope project queries:
    - project_manager: projects created by user (created_by = user.user_id)
    - collector: projects within user's district (district = user.district)
    - policymaker, admin, auditor: all projects (no filter)
    """
    if user.role == "project_manager":
        return {"created_by": user.user_id}
    elif user.role == "collector":
        return {"district": user.district}
    elif user.role in ("policymaker", "admin", "auditor"):
        return {}
    return {"created_by": user.user_id}

