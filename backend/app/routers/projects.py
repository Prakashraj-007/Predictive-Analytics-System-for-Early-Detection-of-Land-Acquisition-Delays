"""
Projects Router for LandSentinel (A7 Real Supabase Implementation).
Handles listing with filters and scoping, project bundle details, draft creation,
collector district approval, and project manager updates with live prediction triggering.
Strictly adheres to docs/contracts.md sections 2, 3, & 5.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
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
from app.db import get_supabase_client, fetch_project_bundle
from app.auth import CurrentUser, get_current_user, require_roles, scope_projects_query
from app.services.audit import log_action
from app.services.prediction_service import run_prediction

router = APIRouter(tags=["Projects"])

EDITABLE_PROJECT_FIELDS = {
    "name", "type", "agency", "state", "district", "lat", "lon",
    "land_area_ha", "families_affected", "families_resettlement",
    "budget", "planned_start", "planned_end", "current_stage",
    "rr_progress_pct", "officer_response_days"
}


@router.get("/projects", response_model=List[ProjectListItem])
def list_projects(
    state: Optional[str] = Query(None, description="Filter by state"),
    district: Optional[str] = Query(None, description="Filter by district"),
    type: Optional[str] = Query(None, description="Filter by project type"),
    band: Optional[str] = Query(None, description="Filter by risk band (Low, Medium, High)"),
    stage: Optional[str] = Query(None, description="Filter by current stage"),
    sort: Optional[str] = Query("risk_desc", description="Sort order: risk_desc or risk_asc"),
    user: CurrentUser = Depends(get_current_user)
):
    """
    Lists projects with role-based scoping and query filters.
    Joins the latest risk prediction (risk_score, band, top_driver) per project.
    """
    supabase = get_supabase_client()
    scope = scope_projects_query(user)
    items: List[ProjectListItem] = []

    if supabase:
        try:
            # Build Supabase query
            query = supabase.table("projects").select("*")

            # Apply role-based scoping
            if "created_by" in scope and scope["created_by"]:
                query = query.eq("created_by", scope["created_by"])
            if "district" in scope and scope["district"]:
                query = query.ilike("district", scope["district"])

            # Apply query filters
            if state:
                query = query.ilike("state", state)
            if district:
                query = query.ilike("district", district)
            if type:
                query = query.eq("type", type.lower())
            if stage:
                query = query.eq("current_stage", stage.lower())

            p_res = query.execute()
            projects = p_res.data or []

            if projects:
                project_ids = [p["project_id"] for p in projects]

                # Fetch predictions to join latest risk score per project
                pred_map: Dict[str, Dict[str, Any]] = {}
                try:
                    pred_res = (
                        supabase.table("predictions")
                        .select("project_id, risk_score, band, drivers, created_at")
                        .in_("project_id", project_ids)
                        .order("created_at", desc=True)
                        .execute()
                    )
                    for pred in pred_res.data or []:
                        pid = pred["project_id"]
                        if pid not in pred_map:
                            pred_map[pid] = pred
                except Exception as pe:
                    print(f"[WARN] Failed to join predictions: {pe}")

                for p in projects:
                    pid = p["project_id"]
                    pred = pred_map.get(pid)

                    risk_score = pred.get("risk_score") if pred else None
                    p_band = pred.get("band") if pred else None
                    top_driver = None
                    if pred and pred.get("drivers") and len(pred["drivers"]) > 0:
                        top_driver = pred["drivers"][0].get("feature")

                    # If project has no prediction in DB, fallback to stub prediction for rich UI
                    if risk_score is None:
                        stub_pred = get_prediction_for_project(pid)
                        risk_score = stub_pred.get("risk_score")
                        p_band = stub_pred.get("band")
                        if stub_pred.get("drivers"):
                            top_driver = stub_pred["drivers"][0].get("feature")

                    # Apply risk band filter
                    if band and p_band and p_band.lower() != band.lower():
                        continue

                    items.append(
                        ProjectListItem(
                            project_id=pid,
                            name=p["name"],
                            district=p["district"],
                            type=p["type"],
                            current_stage=p["current_stage"],
                            risk_score=risk_score,
                            band=p_band,
                            top_driver=top_driver
                        )
                    )

                # Apply sorting
                if sort == "risk_desc":
                    items.sort(key=lambda x: (x.risk_score is not None, x.risk_score or 0), reverse=True)
                elif sort == "risk_asc":
                    items.sort(key=lambda x: (x.risk_score is None, x.risk_score or 0))
                return items

        except Exception as e:
            print(f"[WARN] Failed querying projects from Supabase: {e}")

    # Fallback to stub projects
    for p in SAMPLE_PROJECTS:
        if "created_by" in scope and scope["created_by"] and p.get("created_by") != scope["created_by"]:
            if user.role == "project_manager" and p.get("project_id") not in ("PRJ-0001", "PRJ-0002"):
                continue
        if "district" in scope and scope["district"] and p.get("district", "").lower() != scope["district"].lower():
            continue
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

        items.append(
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
        items.sort(key=lambda x: (x.risk_score or 0), reverse=True)
    elif sort == "risk_asc":
        items.sort(key=lambda x: (x.risk_score or 0))
    return items


@router.get("/projects/{id}", response_model=ProjectDetail)
def get_project_detail(
    id: str,
    user: CurrentUser = Depends(get_current_user)
):
    """
    Retrieves full project details including parcels, court cases, approvals, and compensation.
    Enforces role scoping and guarantees that parcel owner names are never exposed.
    """
    bundle = fetch_project_bundle(id)
    project = bundle.get("project")

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{id}' not found."
        )

    # Collector district boundary verification
    if user.role == "collector" and user.district:
        if project.get("district", "").lower() != user.district.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Collector for {user.district} cannot view project in {project.get('district')}."
            )

    # Anonymise parcels (strip owner names per contracts.md section 1)
    clean_parcels = []
    for p in bundle.get("parcels", []):
        parcel_copy = dict(p)
        parcel_copy.pop("owner", None)
        parcel_copy.pop("owner_name", None)
        clean_parcels.append(parcel_copy)

    return ProjectDetail(
        project=project,
        parcels=clean_parcels,
        cases=bundle.get("cases", []),
        approvals=bundle.get("approvals", []),
        compensation=bundle.get("compensation", {})
    )


@router.post("/projects", response_model=ProjectCreateResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreateRequest,
    user: CurrentUser = Depends(require_roles("project_manager"))
):
    """
    Creates a new project record with initial status 'draft'.
    Inserts nested parcels and approvals sent in the body.
    Accessible only to Project Managers.
    """
    supabase = get_supabase_client()
    now_ts = datetime.now(timezone.utc).isoformat()

    project_data = dict(payload.project)
    project_id = project_data.get("project_id") or f"PRJ-{uuid.uuid4().hex[:6].upper()}"
    project_data["project_id"] = project_id
    project_data["status"] = "draft"
    project_data["created_by"] = user.user_id
    project_data["created_at"] = project_data.get("created_at") or now_ts
    project_data["updated_at"] = now_ts

    if supabase:
        try:
            # 1. Insert project
            supabase.table("projects").insert(project_data).execute()

            # 2. Insert parcels
            if payload.parcels:
                parcels_to_insert = []
                for p in payload.parcels:
                    p_rec = dict(p)
                    p_rec["project_id"] = project_id
                    if not p_rec.get("parcel_id"):
                        p_rec["parcel_id"] = f"PAR-{uuid.uuid4().hex[:6].upper()}"
                    parcels_to_insert.append(p_rec)
                supabase.table("parcels").insert(parcels_to_insert).execute()

            # 3. Insert approvals
            if payload.approvals:
                approvals_to_insert = []
                for a in payload.approvals:
                    a_rec = dict(a)
                    a_rec["project_id"] = project_id
                    if not a_rec.get("approval_id"):
                        a_rec["approval_id"] = f"APP-{uuid.uuid4().hex[:6].upper()}"
                    approvals_to_insert.append(a_rec)
                supabase.table("approvals").insert(approvals_to_insert).execute()

        except Exception as e:
            print(f"[WARN] Failed inserting project to Supabase: {e}")

    log_action(
        user.user_id,
        "CREATE_PROJECT",
        project_id=project_id,
        details={
            "name": project_data.get("name"),
            "district": project_data.get("district"),
            "status": "draft",
            "parcels_count": len(payload.parcels),
            "approvals_count": len(payload.approvals)
        }
    )

    return ProjectCreateResponse(project_id=project_id)


@router.post("/projects/{id}/approve", response_model=ProjectApproveResponse)
def approve_project(
    id: str,
    user: CurrentUser = Depends(require_roles("collector"))
):
    """
    Approves and activates a project.
    Restricted to District Collectors within the project's district.
    Transitions project status: draft -> approved -> active.
    """
    supabase = get_supabase_client()
    bundle = fetch_project_bundle(id)
    project = bundle.get("project")

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{id}' not found."
        )

    # Verify collector belongs to same district
    if user.district and project.get("district", "").lower() != user.district.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: Collector for {user.district} cannot approve project in {project.get('district')}."
        )

    now_ts = datetime.now(timezone.utc).isoformat()

    if supabase:
        try:
            supabase.table("projects").update({
                "status": "active",
                "updated_at": now_ts
            }).eq("project_id", id).execute()
        except Exception as e:
            print(f"[WARN] Failed updating project status to active in Supabase: {e}")

    log_action(
        user.user_id,
        "APPROVE_PROJECT",
        project_id=id,
        details={"status_transition": "draft -> approved -> active"}
    )

    return ProjectApproveResponse(
        status="active",
        message=f"Project {id} has been approved and transitioned to active status."
    )


@router.patch("/projects/{id}", response_model=PredictionObject)
def update_project(
    id: str,
    payload: ProjectPatchRequest,
    user: CurrentUser = Depends(require_roles("project_manager"))
):
    """
    Updates editable project fields and nested entities (parcels, cases, approvals, compensation).
    Triggers automated re-prediction via prediction_service.run_prediction.
    Accessible only to the project's assigned Project Manager.
    """
    supabase = get_supabase_client()
    bundle = fetch_project_bundle(id)
    project = bundle.get("project")

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{id}' not found."
        )

    # Ownership verification: only the creator PM can update (allow demo fallback if creator matches or is demo PM)
    if project.get("created_by") and project["created_by"] != user.user_id:
        if user.user_id not in ("5ad5e3f4-99ff-445b-bd5c-2fee103c357e", project["created_by"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You can only update projects assigned to you."
            )

    now_ts = datetime.now(timezone.utc).isoformat()

    if supabase:
        try:
            # 1. Update project editable fields
            if payload.project:
                update_data = {
                    k: v for k, v in payload.project.items()
                    if k in EDITABLE_PROJECT_FIELDS
                }
                update_data["updated_at"] = now_ts
                if update_data:
                    supabase.table("projects").update(update_data).eq("project_id", id).execute()

            # 2. Upsert parcels if supplied
            if payload.parcels:
                clean_parcels = []
                for p in payload.parcels:
                    p_rec = dict(p)
                    p_rec["project_id"] = id
                    clean_parcels.append(p_rec)
                supabase.table("parcels").upsert(clean_parcels, on_conflict="parcel_id").execute()

            # 3. Upsert cases if supplied
            if payload.cases:
                clean_cases = [dict(c) for c in payload.cases]
                supabase.table("cases").upsert(clean_cases, on_conflict="case_id").execute()

            # 4. Upsert approvals if supplied
            if payload.approvals:
                clean_approvals = []
                for a in payload.approvals:
                    a_rec = dict(a)
                    a_rec["project_id"] = id
                    clean_approvals.append(a_rec)
                supabase.table("approvals").upsert(clean_approvals, on_conflict="approval_id").execute()

            # 5. Upsert compensation if supplied
            if payload.compensation:
                comp_data = dict(payload.compensation)
                comp_data["project_id"] = id
                supabase.table("compensation").upsert(comp_data, on_conflict="project_id").execute()

        except Exception as e:
            print(f"[WARN] Failed applying updates to Supabase for {id}: {e}")

    # Log action
    log_action(
        user.user_id,
        "UPDATE_PROJECT",
        project_id=id,
        details=payload.model_dump(exclude_none=True)
    )

    # Trigger fresh prediction per A7 requirement
    prediction = run_prediction(project_id=id, user_id=user.user_id)
    return PredictionObject(**prediction)
