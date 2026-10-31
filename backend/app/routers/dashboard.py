"""
Dashboard Router for LandSentinel.
Strictly adheres to docs/contracts.md section 3 & 5.
"""
from typing import List
from fastapi import APIRouter, Depends
from app.schemas import (
    DashboardSummaryResponse,
    BandDistribution,
    TopRiskItem,
    DistrictRiskItem,
    TrendItem
)
from app.stubs import SAMPLE_PROJECTS
from app.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(user: CurrentUser = Depends(get_current_user)):
    projects = SAMPLE_PROJECTS
    if user.role == "collector" and user.district:
        projects = [p for p in SAMPLE_PROJECTS if p.get("district", "").lower() == user.district.lower()]

    total = len(projects)
    high_risk = sum(1 for p in projects if p.get("band") == "High")
    avg_score = round(sum(p.get("risk_score", 0) for p in projects) / total, 1) if total else 0.0
    
    low_cnt = sum(1 for p in projects if p.get("band") == "Low")
    med_cnt = sum(1 for p in projects if p.get("band") == "Medium")
    high_cnt = sum(1 for p in projects if p.get("band") == "High")

    top_projects = sorted(projects, key=lambda x: x.get("risk_score", 0), reverse=True)[:3]
    top_risk_items = [
        TopRiskItem(
            project_id=p["project_id"],
            name=p["name"],
            risk_score=p["risk_score"],
            top_driver=p.get("top_driver", "litigation_cases")
        )
        for p in top_projects
    ]

    return DashboardSummaryResponse(
        total_projects=total,
        high_risk_projects=high_risk,
        avg_risk_score=avg_score,
        projects_with_alerts=2 if user.role != "collector" else 1,
        band_distribution=BandDistribution(Low=low_cnt, Medium=med_cnt, High=high_cnt),
        top_risk=top_risk_items
    )

@router.get("/districts", response_model=List[DistrictRiskItem])
def get_district_risk_breakdown(user: CurrentUser = Depends(get_current_user)):
    districts = [
        DistrictRiskItem(district="Pune", avg_risk=62.0, project_count=2, high_risk_count=1),
        DistrictRiskItem(district="Thane", avg_risk=84.0, project_count=1, high_risk_count=1),
        DistrictRiskItem(district="Nagpur", avg_risk=52.0, project_count=1, high_risk_count=0),
        DistrictRiskItem(district="Nashik", avg_risk=24.0, project_count=1, high_risk_count=0),
        DistrictRiskItem(district="Solapur", avg_risk=18.0, project_count=1, high_risk_count=0),
    ]
    if user.role == "collector" and user.district:
        return [d for d in districts if d.district.lower() == user.district.lower()]
    return districts

@router.get("/trend", response_model=List[TrendItem])
def get_monthly_risk_trend(user: CurrentUser = Depends(get_current_user)):
    return [
        TrendItem(month="2026-05", avg_risk=42.5),
        TrendItem(month="2026-06", avg_risk=44.0),
        TrendItem(month="2026-07", avg_risk=48.2),
        TrendItem(month="2026-08", avg_risk=51.0),
        TrendItem(month="2026-09", avg_risk=53.4),
        TrendItem(month="2026-10", avg_risk=50.3),
    ]
