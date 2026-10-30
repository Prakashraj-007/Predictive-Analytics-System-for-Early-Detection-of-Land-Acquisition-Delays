"""
Projects Router (Stub implementation for A4)
Strictly adheres to docs/contracts.md section 3 & 5.
"""
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status
from app.schemas import (
    ProjectListItem,
    ProjectDetail,
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectApproveResponse,
    ProjectPatchRequest,
    PredictionObject
)
from app.stubs import (
    SAMPLE_PROJECTS,
    SAMPLE_PARCELS,
    SAMPLE_CASES,
    SAMPLE_APPROVALS,
    SAMPLE_COMPENSATION,
    get_prediction_for_project
)

router = APIRouter(tags=["Projects"])

@router.get("/projects", response_model=List[ProjectListItem])
def list_projects(
    state: Optional[str] = Query(None, description="Filter by state"),
    district: Optional[str] = Query(None, description="Filter by district"),
    type: Optional[str] = Query(None, description="Filter by project type"),
    band: Optional[str] = Query(None, description="Filter by risk band (Low, Medium, High)"),
    stage: Optional[str] = Query(None, description="Filter by current stage"),
    sort: Optional[str] = Query("risk_desc", description="Sort order, e.g. risk_desc")
):
    results = []
    for p in SAMPLE_PROJECTS:
        if state and p.get("state", "").lower() != state.lower():
            continue
        if district and p.get("district", "").lower() != district.lower():
            continue
        if type and p.get("type", "").lower() != type.lower():
            continue
        if band and p.get("band", "").lower() != band.lower():
            continue
        if stage and p.get("current_stage", "").lower() != stage.lower():
            continue
        results.append(
            ProjectListItem(
                project_id=p["project_id"],
                name=p["name"],
                district=p["district"],
                type=p["type"],
                current_stage=p["current_stage"],
                risk_score=p.get("risk_score"),
                band=p.get("band"),
                top_driver=p.get("top_driver")
            )
        )
    
    if sort == "risk_desc":
        results.sort(key=lambda x: (x.risk_score or 0), reverse=True)
    elif sort == "risk_asc":
        results.sort(key=lambda x: (x.risk_score or 0))
    return results

@router.get("/projects/{id}", response_model=ProjectDetail)
def get_project_detail(id: str):
    project = next((p for p in SAMPLE_PROJECTS if p["project_id"] == id), None)
    if not project:
        # Fallback to first project shaped with this ID for robust stub testing
        project = {**SAMPLE_PROJECTS[0], "project_id": id}
    
    parcels = SAMPLE_PARCELS.get(id, SAMPLE_PARCELS["PRJ-0001"])
    cases = SAMPLE_CASES.get(id, SAMPLE_CASES["PRJ-0001"])
    approvals = SAMPLE_APPROVALS.get(id, SAMPLE_APPROVALS["PRJ-0001"])
    compensation = SAMPLE_COMPENSATION.get(id, SAMPLE_COMPENSATION["PRJ-0001"])

    return ProjectDetail(
        project=project,
        parcels=parcels,
        cases=cases,
        approvals=approvals,
        compensation=compensation
    )

@router.post("/projects", response_model=ProjectCreateResponse, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreateRequest):
    # In stub mode, accept payload and return a stubbed generated project ID
    new_id = payload.project.get("project_id") or "PRJ-0007"
    return ProjectCreateResponse(project_id=new_id)

@router.post("/projects/{id}/approve", response_model=ProjectApproveResponse)
def approve_project(id: str):
    return ProjectApproveResponse(
        status="approved",
        message=f"Project {id} successfully transitioned to approved status."
    )

@router.patch("/projects/{id}", response_model=PredictionObject)
def update_project(id: str, payload: ProjectPatchRequest):
    # Updating project returns full updated prediction object (contracts.md section 3 & 4)
    return get_prediction_for_project(id)

