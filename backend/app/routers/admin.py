"""
Admin Router (Stub implementation for A4)
Strictly adheres to docs/contracts.md section 3.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File, status
from app.schemas import (
    AdminUploadResponse,
    RetrainRequest,
    RetrainStatusResponse,
    ModelVersionItem
)
from app.stubs import SAMPLE_MODELS

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.post("/upload", response_model=AdminUploadResponse)
async def upload_training_csv(file: UploadFile = File(...)):
    # Stub CSV processing response
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
    return AdminUploadResponse(
        filename=filename,
        rows=500,
        columns=columns
    )

@router.post("/retrain", status_code=status.HTTP_202_ACCEPTED)
def trigger_retraining(payload: RetrainRequest):
    return {"message": "Retraining job queued successfully", "file": payload.file}

@router.get("/retrain/status", response_model=RetrainStatusResponse)
def get_retrain_status():
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
def list_models():
    return [ModelVersionItem(**m) for m in SAMPLE_MODELS]

@router.post("/models/{version}/activate")
def activate_model(version: str):
    return {
        "status": "activated",
        "version": version,
        "message": f"Model version {version} is now active."
    }
