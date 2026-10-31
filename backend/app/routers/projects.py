"""
Projects Router for LandSentinel.
Strictly adheres to docs/contracts.md section 3 & 5.
"""
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status, Depends
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
from app.auth import CurrentUser, get_current_user, require_roles, scope_projects_query
from app.services.audit import log_action

router = APIRouter(tags=["Projects"])

@router.get("/projects", response_model=List[ProjectListItem])
def list_projects(
    state: Optional[str] = Query(None, description="Filter by state"),
    district: Optional[str] = Query(None, description="Filter by district"),
    type: Optional[str] = Query(None, description="Filter by project type"),
    band: Optional[str] = Query(None, description="Filter by risk band (Low, Medium, High)"),
    stage: Optional[str] = Query(None, description="Filter by current stage"),
    sort: Optional[str] = Query("risk_desc", description="Sort order, e.g. risk_desc"),
    user: CurrentUser = Depends(get_current_user)
):
    scope = scope_projects_query(user)
    results = []
    
    for p in SAMPLE_PROJECTS:
        # Enforce role-based query scoping
        if "created_by" in scope and p.get("created_by") != scope["created_by"]:
            # In stub mode, if user created_by doesn't match sample project, allow demo pm1 project PRJ-0001
            if user.role == "project_manager" and p.get("project_id") not in ("PRJ-0001", "PRJ-0002"):
                continue
        if "district" in scope and scope["district"] and p.get("district", "").lower() != scope["district"].lower():
            continue

        # Enforce query parameter filters
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
def get_project_detail(
    id: str,
    user: CurrentUser = Depends(get_current_user)
):
    project = next((p for p in SAMPLE_PROJECTS if p["project_id"] == id), None)
    if not project:
        project = {**SAMPLE_PROJECTS[0], "project_id": id}
    
    # Enforce district scope for collector
    if user.role == "collector" and user.district:
        if project.get("district", "").lower() != user.district.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Collector for {user.district} cannot view project in {project.get('district')}."
            )

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
def create_project(
    payload: ProjectCreateRequest,
    user: CurrentUser = Depends(require_roles("project_manager"))
):
    new_id = payload.project.get("project_id") or "PRJ-0007"
    log_action(user.user_id, "CREATE_PROJECT", project_id=new_id, details=payload.project)
    return ProjectCreateResponse(project_id=new_id)

@router.post("/projects/{id}/approve", response_model=ProjectApproveResponse)
def approve_project(
    id: str,
    user: CurrentUser = Depends(require_roles("collector"))
):
    project = next((p for p in SAMPLE_PROJECTS if p["project_id"] == id), None)
    if project and user.district and project.get("district", "").lower() != user.district.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: Collector for {user.district} cannot approve project in {project.get('district')}."
        )

    log_action(user.user_id, "APPROVE_PROJECT", project_id=id)
    return ProjectApproveResponse(
        status="approved",
        message=f"Project {id} successfully transitioned to approved status."
    )

@router.patch("/projects/{id}", response_model=PredictionObject)
def update_project(
    id: str,
    payload: ProjectPatchRequest,
    user: CurrentUser = Depends(require_roles("project_manager"))
):
    log_action(user.user_id, "UPDATE_PROJECT", project_id=id, details=payload.model_dump(exclude_none=True))
    return get_prediction_for_project(id)
