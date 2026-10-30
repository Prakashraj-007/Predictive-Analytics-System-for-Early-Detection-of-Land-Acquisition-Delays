"""
Map Router (Stub implementation for A4)
Strictly adheres to docs/contracts.md section 3.
"""
from typing import List, Optional
from fastapi import APIRouter, Query
from app.schemas import MapProjectItem
from app.stubs import SAMPLE_PROJECTS

router = APIRouter(prefix="/map", tags=["Map"])

@router.get("/projects", response_model=List[MapProjectItem])
def get_map_projects(
    district: Optional[str] = Query(None, description="Filter by district"),
    band: Optional[str] = Query(None, description="Filter by risk band (Low, Medium, High)")
):
    results = []
    for p in SAMPLE_PROJECTS:
        if district and p.get("district", "").lower() != district.lower():
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
