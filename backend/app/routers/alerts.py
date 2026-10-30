"""
Alerts Router (Stub implementation for A4)
Strictly adheres to docs/contracts.md section 3.
"""
from typing import List
from fastapi import APIRouter
from app.schemas import AlertItem, AlertAckResponse
from app.stubs import SAMPLE_ALERTS

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertItem])
def list_alerts():
    return [AlertItem(**a) for a in SAMPLE_ALERTS]

@router.post("/{id}/ack", response_model=AlertAckResponse)
def acknowledge_alert(id: str):
    return AlertAckResponse(
        status="ack",
        alert_id=id
    )

