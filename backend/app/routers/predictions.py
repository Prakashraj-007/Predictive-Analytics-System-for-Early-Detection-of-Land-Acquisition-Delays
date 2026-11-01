"""
Predictions Router for LandSentinel (Task A8 Real Implementation).
Handles delay risk predictions, automated pipeline triggering, and what-if simulations.

Strictly adheres to docs/contracts.md section 3, 4, 5, and A8 specifications.
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas import PredictionObject, WhatIfRequest, WhatIfResponse
from app.auth import CurrentUser, get_current_user, require_roles
from app.db import get_supabase_client, fetch_project_bundle
from app.services.prediction_service import run_prediction, simulate_what_if_service
from app.stubs import get_prediction_for_project

router = APIRouter(tags=["Predictions"])


def _verify_project_access(project_id: str, user: CurrentUser) -> Dict[str, Any]:
    """
    Validates project existence and role-based access control:
    - Collector: restricted to their assigned district.
    - Project Manager: restricted to projects they created (if assigned).
    """
    bundle = fetch_project_bundle(project_id)
    project = bundle.get("project")
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found."
        )

    # Collector district boundary check
    if user.role == "collector" and user.district:
        p_dist = project.get("district", "")
        if p_dist.lower() != user.district.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Collector for {user.district} cannot access project in {p_dist}."
            )

    # Project Manager ownership check
    if user.role == "project_manager" and user.user_id:
        created_by = project.get("created_by")
        if created_by and created_by != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Project Managers can only access their own projects."
            )

    return project


@router.get("/projects/{id}/prediction", response_model=PredictionObject)
def get_project_prediction(
    id: str,
    user: CurrentUser = Depends(require_roles("project_manager", "collector", "policymaker", "admin", "auditor"))
):
    """
    Retrieves the latest saved risk prediction for a project.
    If no prediction exists yet, runs an automated prediction and stores it.
    Accessible to all authorized roles subject to district and ownership scoping.
    """
    _verify_project_access(id, user)

    supabase = get_supabase_client()
    if supabase:
        try:
            res = (
                supabase.table("predictions")
                .select("*")
                .eq("project_id", id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                pred = res.data[0]
                return PredictionObject(
                    project_id=pred["project_id"],
                    created_at=str(pred["created_at"]),
                    risk_score=int(pred["risk_score"]),
                    band=str(pred["band"]),
                    delay_probability=float(pred["delay_probability"]),
                    expected_delay_days=int(pred.get("expected_delay_days", 0)),
                    stage_probabilities=pred.get("stage_probabilities") or {},
                    drivers=pred.get("drivers") or [],
                    recommendations=pred.get("recommendations") or [],
                    model_version=str(pred.get("model_version", "v1"))
                )
        except Exception as e:
            print(f"[WARN] Failed to read prediction from DB: {e}")

    # No saved prediction found -> generate fresh prediction and persist it
    fresh_prediction = run_prediction(project_id=id, user_id=user.user_id)
    return PredictionObject(**fresh_prediction)


@router.post("/projects/{id}/predict", response_model=PredictionObject)
def trigger_project_prediction(
    id: str,
    user: CurrentUser = Depends(require_roles("project_manager", "collector", "policymaker", "admin"))
):
    """
    Forces a fresh run of the prediction pipeline for a project.
    Computes features, model inference, drivers, recommendations, persists the result,
    and checks alert conditions.
    Forbidden for auditors.
    """
    _verify_project_access(id, user)
    fresh_prediction = run_prediction(project_id=id, user_id=user.user_id)
    return PredictionObject(**fresh_prediction)


@router.post("/projects/{id}/what-if", response_model=WhatIfResponse)
def simulate_what_if(
    id: str,
    payload: WhatIfRequest,
    user: CurrentUser = Depends(require_roles("project_manager", "collector", "policymaker", "admin"))
):
    """
    Runs a what-if simulation for hypothetical project changes.
    Does NOT save anything to the database.
    Returns {current_score, new_score, change}.
    Forbidden for auditors.
    """
    _verify_project_access(id, user)
    
    changes_dict = payload.changes.model_dump(exclude_unset=True)
    res = simulate_what_if_service(project_id=id, changes=changes_dict)
    
    return WhatIfResponse(
        current_score=res["current_score"],
        new_score=res["new_score"],
        change=res["change"]
    )
