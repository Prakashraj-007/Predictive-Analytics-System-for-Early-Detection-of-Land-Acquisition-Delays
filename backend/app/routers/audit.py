"""
Audit Router for LandSentinel.
Strictly adheres to docs/contracts.md section 3 & 5.
"""
from typing import List, Optional
from fastapi import APIRouter, Query, Depends
from app.schemas import AuditLogItem
from app.stubs import SAMPLE_AUDIT
from app.auth import CurrentUser, require_roles

router = APIRouter(prefix="/audit", tags=["Audit"])

@router.get("", response_model=List[AuditLogItem])
def list_audit_logs(
    user: Optional[str] = Query(None, description="Filter by user"),
    project: Optional[str] = Query(None, description="Filter by project_id"),
    from_date: Optional[str] = Query(None, alias="from", description="From timestamp (ISO)"),
    to_date: Optional[str] = Query(None, alias="to", description="To timestamp (ISO)"),
    current_user: CurrentUser = Depends(require_roles("admin", "auditor"))
):
    results = []
    for log in SAMPLE_AUDIT:
        if user and user.lower() not in log["user"].lower():
            continue
        if project and log.get("project_id") != project:
            continue
        results.append(AuditLogItem(**log))
    return results
