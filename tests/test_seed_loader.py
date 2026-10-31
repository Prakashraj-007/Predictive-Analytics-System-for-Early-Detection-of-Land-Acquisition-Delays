"""
Tests for LandSentinel Database Layer and Seed Loader (A6).
Tests fetch_project_bundle, fetch_district_past_delay_rate, and seed_loader validation.
"""
import sys
from pathlib import Path
import pytest
import pandas as pd

backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.db import fetch_project_bundle, fetch_district_past_delay_rate
from app.seed_loader import clean_records, TABLE_CONFIG

def test_fetch_project_bundle_structure():
    bundle = fetch_project_bundle("PRJ-0001")
    assert isinstance(bundle, dict)
    required_keys = ["project", "parcels", "cases", "approvals", "compensation", "incidents"]
    for k in required_keys:
        assert k in bundle
    assert bundle["project"]["project_id"] == "PRJ-0001"
    assert isinstance(bundle["parcels"], list)
    assert isinstance(bundle["cases"], list)
    assert isinstance(bundle["approvals"], list)
    assert isinstance(bundle["compensation"], dict)
    assert isinstance(bundle["incidents"], list)

def test_fetch_district_past_delay_rate():
    rate_pune = fetch_district_past_delay_rate("Pune")
    assert isinstance(rate_pune, float)
    assert 0.0 <= rate_pune <= 1.0

    rate_unknown = fetch_district_past_delay_rate("UnknownDistrict")
    assert rate_unknown == 0.3

def test_clean_records_parcels():
    parcel_cfg = next(c for c in TABLE_CONFIG if c["table"] == "parcels")
    df = pd.DataFrame([{
        "parcel_id": "P-1",
        "project_id": "PRJ-1",
        "survey_no": "100",
        "area_ha": "15.5",
        "land_type": "private",
        "compensation_status": "pending",
        "possession_status": "pending",
        "doc_complete": "true",
        "ownership_dispute": "0"
    }])
    records = clean_records(df, parcel_cfg)
    assert len(records) == 1
    r = records[0]
    assert r["area_ha"] == 15.5
    assert r["doc_complete"] is True
    assert r["ownership_dispute"] is False

def test_clean_records_projects_nan_handling():
    project_cfg = next(c for c in TABLE_CONFIG if c["table"] == "projects")
    df = pd.DataFrame([{
        "project_id": "PRJ-TEST",
        "name": "Test Project",
        "type": "highway",
        "agency": "NHAI",
        "state": "Maharashtra",
        "district": "Pune",
        "lat": 18.5,
        "lon": 73.8,
        "land_area_ha": 50.0,
        "families_affected": 20,
        "families_resettlement": 5,
        "budget": 1000000.0,
        "planned_start": "2026-01-01",
        "planned_end": "2027-01-01",
        "current_stage": "planning",
        "status": "draft",
        "rr_progress_pct": 0.0,
        "officer_response_days": 10,
        "created_by": None
    }])
    records = clean_records(df, project_cfg)
    assert len(records) == 1
    assert records[0]["created_by"] is not None
