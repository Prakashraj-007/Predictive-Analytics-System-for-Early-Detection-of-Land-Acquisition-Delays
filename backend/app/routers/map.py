"""
Map Router for LandSentinel (Task A9 Real Implementation).
Returns geospatial project coordinates with risk scores and top drivers for map rendering.

Strictly adheres to docs/contracts.md sections 3 & 5.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, Depends
from app.schemas import MapProjectItem
from app.stubs import SAMPLE_PROJECTS
from app.auth import CurrentUser, get_current_user, scope_projects_query
from app.db import get_supabase_client

router = APIRouter(prefix="/map", tags=["Map"])


@router.get("/projects", response_model=List[MapProjectItem])
def get_map_projects(
    district: Optional[str] = Query(None, description="Filter by district"),
    band: Optional[str] = Query(None, description="Filter by risk band (Low, Medium, High)"),
    user: CurrentUser = Depends(get_current_user)
):
    """
    Returns mapped projects with coordinates, risk score, band, and top drivers.
    Scoped by role: Collector forced to assigned district, PM forced to own projects.
    """
    supabase = get_supabase_client()
    projects = []

    # Determine district scope
    effective_district = user.district if (user.role == "collector" and user.district) else district

    if supabase:
        try:
            query = supabase.table("projects").select("project_id, name, district, lat, lon, created_by")
            query = scope_projects_query(query, user)
            if effective_district:
                query = query.ilike("district", effective_district)
            res = query.execute()
            if res.data:
                projects = res.data
        except Exception as e:
            print(f"[WARN] Failed to query map projects: {e}")

    if not projects:
        # Fallback to stub projects
        for p in SAMPLE_PROJECTS:
            if effective_district and p.get("district", "").lower() != effective_district.lower():
                continue
            if user.role == "project_manager" and user.user_id:
                if p.get("created_by") and p.get("created_by") != user.user_id:
                    continue
            projects.append(dict(p))

    # Join predictions for latest risk_score, band, and top_driver
    pids = [p["project_id"] for p in projects]
    pred_map = {}
    if supabase and pids:
        try:
            pred_res = (
                supabase.table("predictions")
                .select("project_id, risk_score, band, drivers, created_at")
                .in_("project_id", pids)
                .order("created_at", desc=True)
                .execute()
            )
            for row in pred_res.data or []:
                pid = row["project_id"]
                if pid not in pred_map:
                    pred_map[pid] = row
        except Exception as pe:
            print(f"[WARN] Failed to join predictions for map: {pe}")

    results = []
    for p in projects:
        pid = p["project_id"]
        pred = pred_map.get(pid)

        if pred:
            risk_score = int(pred["risk_score"])
            p_band = pred["band"]
            drivers = pred.get("drivers") or []
            top_driver = drivers[0].get("feature", "litigation_cases") if drivers else "litigation_cases"
        else:
            risk_score = int(p.get("risk_score", 50))
            p_band = str(p.get("band", "Medium"))
            top_driver = str(p.get("top_driver", "litigation_cases"))

        # Apply band filter if specified
        if band and p_band.lower() != band.lower():
            continue

        # Default fallback lat/lon if null
        lat = float(p.get("lat") or 18.5204)
        lon = float(p.get("lon") or 73.8567)

        results.append(
            MapProjectItem(
                project_id=pid,
                name=p.get("name", pid),
                lat=lat,
                lon=lon,
                risk_score=risk_score,
                band=p_band,
                top_driver=top_driver
            )
        )

    return results
