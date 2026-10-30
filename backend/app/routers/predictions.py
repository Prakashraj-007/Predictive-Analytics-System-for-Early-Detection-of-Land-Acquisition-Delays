"""
Predictions Router (Stub implementation for A4)
Strictly adheres to docs/contracts.md section 3 & 4.
"""
from fastapi import APIRouter
from app.schemas import PredictionObject, WhatIfRequest, WhatIfResponse
from app.stubs import get_prediction_for_project, SAMPLE_PROJECTS

router = APIRouter(tags=["Predictions"])

@router.get("/projects/{id}/prediction", response_model=PredictionObject)
def get_project_prediction(id: str):
    return get_prediction_for_project(id)

@router.post("/projects/{id}/predict", response_model=PredictionObject)
def trigger_project_prediction(id: str):
    return get_prediction_for_project(id)

@router.post("/projects/{id}/what-if", response_model=WhatIfResponse)
def simulate_what_if(id: str, payload: WhatIfRequest):
    project = next((p for p in SAMPLE_PROJECTS if p["project_id"] == id), None)
    current_score = project["risk_score"] if project else 78
    
    # Calculate simulated change based on input parameter shifts
    change = 0
    changes = payload.changes
    if changes.litigation_cases is not None:
        change -= 12 if changes.litigation_cases == 0 else 6
    if changes.compensation_pending_pct is not None:
        if changes.compensation_pending_pct < 20:
            change -= 8
        elif changes.compensation_pending_pct > 60:
            change += 5
    if changes.docs_incomplete_pct is not None:
        if changes.docs_incomplete_pct < 10:
            change -= 5
    if changes.approval_days_pending is not None:
        if changes.approval_days_pending == 0:
            change -= 7

    if change == 0:
        change = -14  # Default realistic positive reduction for simulator demonstration

    new_score = max(0, min(100, current_score + change))
    
    return WhatIfResponse(
        current_score=current_score,
        new_score=new_score,
        change=(new_score - current_score)
    )
