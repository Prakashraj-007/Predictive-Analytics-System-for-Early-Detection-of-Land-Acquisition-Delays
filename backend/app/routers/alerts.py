"""
Alerts Router for LandSentinel.
Strictly adheres to docs/contracts.md section 3 & 5.
"""
from typing import List
from fastapi import APIRouter, Depends
from app.schemas import AlertItem, AlertAckResponse
from app.stubs import SAMPLE_ALERTS
from app.auth import CurrentUser, get_current_user, require_roles
from app.services.audit import log_action

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertItem])
def list_alerts(user: CurrentUser = Depends(get_current_user)):
    results = []
    for a in SAMPLE_ALERTS:
        # Collector: only own district alerts
        if user.role == "collector" and user.district:
            if a.get("district", "").lower() != user.district.lower():
                continue
        # Policymaker: High alerts only
        if user.role == "policymaker" and a.get("risk_score", 0) <= 60:
            continue
        results.append(AlertItem(**a))
    return results

@router.post("/{id}/ack", response_model=AlertAckResponse)
def acknowledge_alert(
    id: str,
    user: CurrentUser = Depends(require_roles("project_manager", "collector", "policymaker", "admin"))
):
    log_action(user.user_id, "ACKNOWLEDGE_ALERT", details={"alert_id": id})
    return AlertAckResponse(
        status="ack",
        alert_id=id
    )
