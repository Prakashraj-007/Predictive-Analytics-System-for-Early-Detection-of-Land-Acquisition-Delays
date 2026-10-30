"""
Audit Router (Stub implementation for A4)
Strictly adheres to docs/contracts.md section 3.
"""
from typing import List, Optional
from fastapi import APIRouter, Query
from app.schemas import AuditLogItem
from app.stubs import SAMPLE_AUDIT

router = APIRouter(prefix="/audit", tags=["Audit"])

@router.get("", response_model=List[AuditLogItem])
def list_audit_logs(
    user: Optional[str] = Query(None, description="Filter by user"),
    project: Optional[str] = Query(None, description="Filter by project_id"),
    from_date: Optional[str] = Query(None, alias="from", description="From timestamp (ISO)"),
    to_date: Optional[str] = Query(None, alias="to", description="To timestamp (ISO)")
):
    results = []
    for log in SAMPLE_AUDIT:
        if user and user.lower() not in log["user"].lower():
            continue
        if project and log.get("project_id") != project:
            continue
        results.append(AuditLogItem(**log))
    return results
