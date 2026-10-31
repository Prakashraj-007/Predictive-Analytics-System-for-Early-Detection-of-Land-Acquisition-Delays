"""
Admin Router for LandSentinel.
Strictly adheres to docs/contracts.md section 3 & 5.
"""
from typing import List
from fastapi import APIRouter, UploadFile, File, status, Depends
from app.schemas import (
    AdminUploadResponse,
    RetrainRequest,
    RetrainStatusResponse,
    ModelVersionItem
)
from app.stubs import SAMPLE_MODELS
from app.auth import CurrentUser, require_roles
from app.services.audit import log_action

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.post("/upload", response_model=AdminUploadResponse)
async def upload_training_csv(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_roles("admin"))
):
    filename = file.filename or "retrain_dataset.csv"
    columns = [
        "project_id", "planned_start", "land_area_ha", "families_affected",
        "project_type", "litigation_cases", "stay_orders", "ownership_disputes",
        "compensation_pending_pct", "approval_days_pending", "docs_incomplete_pct",
        "officer_response_days", "encroached_area_pct", "possession_pct",
        "rr_progress_pct", "current_stage", "district_past_delay_rate",
        "is_delayed", "delay_days", "delayed_approval", "delayed_compensation",
        "delayed_possession"
    ]
    log_action(user.user_id, "UPLOAD_DATASET", details={"filename": filename, "rows": 500})
    return AdminUploadResponse(
        filename=filename,
        rows=500,
        columns=columns
    )

@router.post("/retrain", status_code=status.HTTP_202_ACCEPTED)
def trigger_retraining(
    payload: RetrainRequest,
    user: CurrentUser = Depends(require_roles("admin"))
):
    log_action(user.user_id, "TRIGGER_RETRAINING", details={"file": payload.file})
    return {"message": "Retraining job queued successfully", "file": payload.file}

@router.get("/retrain/status", response_model=RetrainStatusResponse)
def get_retrain_status(user: CurrentUser = Depends(require_roles("admin"))):
    return RetrainStatusResponse(
        state="done",
        result={
            "before": {"auc": 0.884, "f1_score": 0.826, "mae_days": 18.2},
            "after": {"auc": 0.902, "f1_score": 0.849, "mae_days": 16.5},
            "new_version": "v1.1",
            "promoted": True
        }
    )

@router.get("/models", response_model=List[ModelVersionItem])
def list_models(user: CurrentUser = Depends(require_roles("admin"))):
    return [ModelVersionItem(**m) for m in SAMPLE_MODELS]

@router.post("/models/{version}/activate")
def activate_model(
    version: str,
    user: CurrentUser = Depends(require_roles("admin"))
):
    log_action(user.user_id, "ACTIVATE_MODEL", model_version=version)
    return {
        "status": "activated",
        "version": version,
        "message": f"Model version {version} is now active."
    }
