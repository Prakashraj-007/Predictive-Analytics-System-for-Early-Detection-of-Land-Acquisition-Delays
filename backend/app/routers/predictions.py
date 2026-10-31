"""
Predictions Router for LandSentinel.
Strictly adheres to docs/contracts.md section 3, 4, & 5.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas import PredictionObject, WhatIfRequest, WhatIfResponse
from app.stubs import get_prediction_for_project, SAMPLE_PROJECTS
from app.auth import CurrentUser, get_current_user, require_roles

router = APIRouter(tags=["Predictions"])

@router.get("/projects/{id}/prediction", response_model=PredictionObject)
def get_project_prediction(
    id: str,
    user: CurrentUser = Depends(require_roles("project_manager", "collector", "policymaker", "admin", "auditor"))
):
    project = next((p for p in SAMPLE_PROJECTS if p["project_id"] == id), None)
    if project and user.role == "collector" and user.district:
        if project.get("district", "").lower() != user.district.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Collector for {user.district} cannot view prediction for project in {project.get('district')}."
            )
    return get_prediction_for_project(id)

@router.post("/projects/{id}/predict", response_model=PredictionObject)
def trigger_project_prediction(
    id: str,
    user: CurrentUser = Depends(require_roles("project_manager", "collector", "policymaker", "admin"))
):
    project = next((p for p in SAMPLE_PROJECTS if p["project_id"] == id), None)
    if project and user.role == "collector" and user.district:
        if project.get("district", "").lower() != user.district.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Collector for {user.district} cannot trigger prediction for project in {project.get('district')}."
            )
    return get_prediction_for_project(id)

@router.post("/projects/{id}/what-if", response_model=WhatIfResponse)
def simulate_what_if(
    id: str,
    payload: WhatIfRequest,
    user: CurrentUser = Depends(require_roles("project_manager", "collector", "policymaker", "admin"))
):
    project = next((p for p in SAMPLE_PROJECTS if p["project_id"] == id), None)
    if project and user.role == "collector" and user.district:
        if project.get("district", "").lower() != user.district.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Collector for {user.district} cannot run what-if for project in {project.get('district')}."
            )

    current_score = project["risk_score"] if project else 78
    
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
        change = -14

    new_score = max(0, min(100, current_score + change))
    
    return WhatIfResponse(
        current_score=current_score,
        new_score=new_score,
        change=(new_score - current_score)
    )
