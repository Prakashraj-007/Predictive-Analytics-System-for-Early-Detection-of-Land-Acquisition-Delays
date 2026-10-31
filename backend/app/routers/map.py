"""
Map Router for LandSentinel.
Strictly adheres to docs/contracts.md section 3 & 5.
"""
from typing import List, Optional
from fastapi import APIRouter, Query, Depends
from app.schemas import MapProjectItem
from app.stubs import SAMPLE_PROJECTS
from app.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/map", tags=["Map"])

@router.get("/projects", response_model=List[MapProjectItem])
def get_map_projects(
    district: Optional[str] = Query(None, description="Filter by district"),
    band: Optional[str] = Query(None, description="Filter by risk band (Low, Medium, High)"),
    user: CurrentUser = Depends(get_current_user)
):
    results = []
    # If collector, scope to their district
    effective_district = user.district if (user.role == "collector" and user.district) else district

    for p in SAMPLE_PROJECTS:
        if effective_district and p.get("district", "").lower() != effective_district.lower():
            continue
        if band and p.get("band", "").lower() != band.lower():
            continue
        results.append(
            MapProjectItem(
                project_id=p["project_id"],
                name=p["name"],
                lat=p["lat"],
                lon=p["lon"],
                risk_score=p["risk_score"],
                band=p["band"],
                top_driver=p.get("top_driver", "litigation_cases")
            )
        )
    return results
