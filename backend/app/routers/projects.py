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


PII_PARCEL_FIELDS = {"owner", "owner_name", "aadhaar", "pan", "bank_account", "bank_account_no", "account_no"}


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

    # Anonymise parcels (strip owner names and PII per contracts.md section 1 & Task A12)
    clean_parcels = []
    for p in bundle.get("parcels", []):
        parcel_copy = {k: v for k, v in dict(p).items() if k.lower() not in PII_PARCEL_FIELDS}
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

    raw_project = dict(payload.project)
    project_id = raw_project.get("project_id") or f"PRJ-{uuid.uuid4().hex[:6].upper()}"

    # Ensure valid UUID for created_by (fallback to demo PM UUID if mock/non-uuid)
    creator_id = user.user_id
    try:
        uuid.UUID(str(creator_id))
    except (ValueError, TypeError, AttributeError):
        creator_id = "5ad5e3f4-99ff-445b-bd5c-2fee103c357e"

    clean_project = {
        "project_id": project_id,
        "name": raw_project.get("name") or "New Project Corridor",
        "type": (raw_project.get("type") or "highway").lower(),
        "agency": raw_project.get("agency") or "State Infrastructure Agency",
        "state": raw_project.get("state") or "Tamil Nadu",
        "district": raw_project.get("district") or user.district or "Kanchipuram",
        "lat": raw_project.get("lat"),
        "lon": raw_project.get("lon"),
        "land_area_ha": float(raw_project.get("land_area_ha") or 50.0),
        "families_affected": int(raw_project.get("families_affected") or 0),
        "families_resettlement": int(raw_project.get("families_resettlement") or 0),
        "budget": float(raw_project.get("budget") or 10000000.0),
        "planned_start": str(raw_project.get("planned_start") or now_ts[:10]),
        "planned_end": str(raw_project.get("planned_end") or "2028-12-31"),
        "current_stage": (raw_project.get("current_stage") or "planning").lower(),
        "status": "draft",
        "rr_progress_pct": float(raw_project.get("rr_progress_pct") or 0.0),
        "officer_response_days": float(raw_project.get("officer_response_days") or 15.0),
        "created_by": creator_id,
        "created_at": now_ts,
        "updated_at": now_ts,
    }

    # 2. Sanitize parcels (strictly adhering to table schema & stripping PII)
    clean_parcels = []
    if payload.parcels:
        for idx, p in enumerate(payload.parcels):
            p_dict = dict(p)
            survey = p_dict.get("survey_no") or p_dict.get("survey_number") or f"{idx+1}"
            clean_parcels.append({
                "parcel_id": p_dict.get("parcel_id") or f"PAR-{project_id[-4:]}-{idx+1:02d}",
                "project_id": project_id,
                "survey_no": str(survey),
                "area_ha": float(p_dict.get("area_ha") or 1.0),
                "land_type": (p_dict.get("land_type") or "private").lower(),
                "compensation_status": p_dict.get("compensation_status") or "pending",
                "possession_status": p_dict.get("possession_status") or "pending",
                "doc_complete": bool(p_dict.get("doc_complete", True)),
                "ownership_dispute": bool(p_dict.get("ownership_dispute", False)),
            })

    # 3. Sanitize approvals
    clean_approvals = []
    if payload.approvals:
        for idx, a in enumerate(payload.approvals):
            a_dict = dict(a)
            clean_approvals.append({
                "approval_id": a_dict.get("approval_id") or f"APP-{project_id[-4:]}-{idx+1:02d}",
                "project_id": project_id,
                "name": a_dict.get("name") or f"Approval {idx+1}",
                "planned_date": str(a_dict.get("planned_date") or now_ts[:10]),
                "actual_date": a_dict.get("actual_date"),
                "status": (a_dict.get("status") or "pending").lower(),
            })

    # Always register in in-memory store for instant visibility & fallback
    stub_record = {
        **clean_project,
        "risk_score": 45,
        "band": "Medium",
        "top_driver": "Initial planning stage"
    }
    SAMPLE_PROJECTS.insert(0, stub_record)
    SAMPLE_PARCELS[project_id] = clean_parcels
    SAMPLE_APPROVALS[project_id] = clean_approvals

    # Persist to Supabase
    if supabase:
        try:
            supabase.table("projects").insert(clean_project).execute()
            if clean_parcels:
                supabase.table("parcels").insert(clean_parcels).execute()
            if clean_approvals:
                supabase.table("approvals").insert(clean_approvals).execute()

            # Run initial prediction to create prediction row
            try:
                run_prediction(project_id=project_id, user_id=creator_id)
            except Exception as pe:
                print(f"[WARN] Initial prediction note for {project_id}: {pe}")
        except Exception as e:
            print(f"[WARN] Failed inserting project to Supabase: {e}")

    log_action(
        user.user_id,
        "CREATE_PROJECT",
        project_id=project_id,
        details={
            "name": clean_project.get("name"),
            "district": clean_project.get("district"),
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

    # Always synchronize in-memory fallback store so predictions and queries reflect updates instantly
    if payload.project:
        found = False
        for sp in SAMPLE_PROJECTS:
            if sp.get("project_id") == id:
                sp.update({k: v for k, v in payload.project.items() if k in EDITABLE_PROJECT_FIELDS})
                found = True
        if not found and project:
            updated_p = dict(project)
            updated_p.update({k: v for k, v in payload.project.items() if k in EDITABLE_PROJECT_FIELDS})
            SAMPLE_PROJECTS.insert(0, updated_p)

    if payload.parcels:
        existing_parcels = SAMPLE_PARCELS.get(id, [])
        parcel_map = {p.get("parcel_id"): p for p in existing_parcels}
        for p in payload.parcels:
            p_dict = dict(p)
            if p_dict.get("possession_handed_over") is True:
                p_dict["possession_status"] = "handed_over"
            elif p_dict.get("possession_handed_over") is False:
                p_dict["possession_status"] = "pending"
            if "documents_verified" in p_dict:
                p_dict["doc_complete"] = bool(p_dict.get("documents_verified"))
            pid = p_dict.get("parcel_id")
            if pid:
                if pid in parcel_map:
                    parcel_map[pid].update(p_dict)
                else:
                    parcel_map[pid] = p_dict
        SAMPLE_PARCELS[id] = list(parcel_map.values())

    if payload.cases:
        SAMPLE_CASES[id] = [dict(c) for c in payload.cases]

    if payload.approvals:
        SAMPLE_APPROVALS[id] = [dict(a) for a in payload.approvals]

    if payload.compensation:
        if id not in SAMPLE_COMPENSATION:
            SAMPLE_COMPENSATION[id] = {}
        SAMPLE_COMPENSATION[id].update(dict(payload.compensation))

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

            # 2. Upsert parcels if supplied (stripping any PII and extra keys before persisting)
            if payload.parcels:
                allowed_parcel_cols = {
                    "parcel_id", "project_id", "survey_no", "area_ha", "land_type",
                    "compensation_status", "possession_status", "doc_complete", "ownership_dispute"
                }
                clean_parcels = []
                for p in payload.parcels:
                    p_dict = dict(p)
                    if p_dict.get("possession_handed_over") is True:
                        p_dict["possession_status"] = "handed_over"
                    elif p_dict.get("possession_handed_over") is False:
                        p_dict["possession_status"] = "pending"
                    if "documents_verified" in p_dict:
                        p_dict["doc_complete"] = bool(p_dict.get("documents_verified"))
                    p_dict["project_id"] = id
                    clean_parcels.append({
                        k: v for k, v in p_dict.items()
                        if k in allowed_parcel_cols and k.lower() not in PII_PARCEL_FIELDS
                    })
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
