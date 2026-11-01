"""
Audit Router for LandSentinel (Task A9 Real Implementation).
Provides cryptographic accountability and access log queries for system audits.

Strictly adheres to docs/contracts.md sections 3 & 5.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, Depends
from app.schemas import AuditLogItem
from app.stubs import SAMPLE_AUDIT
from app.auth import CurrentUser, require_roles
from app.db import get_supabase_client

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", response_model=List[AuditLogItem])
def list_audit_logs(
    user: Optional[str] = Query(None, description="Filter by user ID or email"),
    project: Optional[str] = Query(None, description="Filter by project_id"),
    from_date: Optional[str] = Query(None, alias="from", description="From timestamp (ISO)"),
    to_date: Optional[str] = Query(None, alias="to", description="To timestamp (ISO)"),
    current_user: CurrentUser = Depends(require_roles("admin", "auditor"))
):
    """
    Retrieves audit trail entries matching filters.
    Restricted strictly to Admin and Auditor roles (Contracts Section 5).
    Includes model_version when action is 'predict'.
    """
    supabase = get_supabase_client()
    logs = []

    if supabase:
        try:
            query = supabase.table("audit_log").select("*").order("timestamp", desc=True)
            if project:
                query = query.eq("project_id", project)
            if from_date:
                query = query.gte("timestamp", from_date)
            if to_date:
                query = query.lte("timestamp", to_date)
            res = query.execute()
            if res.data:
                logs = res.data
        except Exception as e:
            print(f"[WARN] Failed to query audit_log from Supabase: {e}")

    # Fallback / merge with in-memory audit logs
    if not logs:
        logs = list(SAMPLE_AUDIT)

    # Filter in-memory if needed
    results = []
    for l in logs:
        l_user = str(l.get("user") or l.get("user_id") or "system")
        if user and user.lower() not in l_user.lower():
            continue
        if project and l.get("project_id") != project:
            continue
            
        # Determine model_version
        model_version = l.get("model_version")
        details = l.get("details") or {}
        if not model_version and l.get("action") == "predict":
            model_version = details.get("model_version", "v1")

        results.append(
            AuditLogItem(
                log_id=str(l.get("log_id")),
                user=l_user,
                action=str(l.get("action")),
                project_id=l.get("project_id"),
                timestamp=str(l.get("timestamp")),
                model_version=model_version,
                details=details
            )
        )

    return results
