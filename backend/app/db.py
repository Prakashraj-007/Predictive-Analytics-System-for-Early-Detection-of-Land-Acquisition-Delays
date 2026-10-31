"""
Database Layer for LandSentinel.
Provides the Supabase Service Role client, project bundle aggregator,
and district delay rate calculations.
Strictly adheres to docs/contracts.md section 2 & 6.
"""
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

from app.stubs import (
    SAMPLE_PROJECTS,
    SAMPLE_PARCELS,
    SAMPLE_CASES,
    SAMPLE_APPROVALS,
    SAMPLE_COMPENSATION,
    SAMPLE_INCIDENTS
)

# Ensure environment variables are loaded
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

_supabase_client = None

def get_supabase_client():
    """
    Returns a cached instance of the Supabase Client using the Service Role Key.
    Bypasses RLS for administrative and backend API orchestration.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(supabase_url, service_role_key)
        return _supabase_client
    except Exception as e:
        print(f"[WARN] Failed to initialize Supabase client: {e}")
        return None


def fetch_project_bundle(project_id: str) -> Dict[str, Any]:
    """
    Fetches the full project entity bundle containing:
    - project (dict)
    - parcels (list[dict])
    - cases (list[dict])
    - approvals (list[dict])
    - compensation (dict)
    - incidents (list[dict])
    
    Queries Supabase Postgres tables when connected, falling back to
    stub data if offline or if the project is not yet in the database.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            # 1. Fetch project record
            p_res = supabase.table("projects").select("*").eq("project_id", project_id).execute()
            if p_res.data and len(p_res.data) > 0:
                project = p_res.data[0]

                # 2. Fetch parcels
                parcels_res = supabase.table("parcels").select("*").eq("project_id", project_id).execute()
                parcels = parcels_res.data or []

                # 3. Fetch cases linked to parcels
                cases = []
                parcel_ids = [p["parcel_id"] for p in parcels if "parcel_id" in p]
                if parcel_ids:
                    # Batch fetch cases by parcel_id list
                    cases_res = supabase.table("cases").select("*").in_("parcel_id", parcel_ids).execute()
                    cases = cases_res.data or []

                # 4. Fetch approvals
                appr_res = supabase.table("approvals").select("*").eq("project_id", project_id).execute()
                approvals = appr_res.data or []

                # 5. Fetch compensation
                comp_res = supabase.table("compensation").select("*").eq("project_id", project_id).execute()
                compensation = comp_res.data[0] if (comp_res.data and len(comp_res.data) > 0) else {}

                # 6. Fetch incidents
                inc_res = supabase.table("incidents").select("*").eq("project_id", project_id).execute()
                incidents = inc_res.data or []

                return {
                    "project": project,
                    "parcels": parcels,
                    "cases": cases,
                    "approvals": approvals,
                    "compensation": compensation,
                    "incidents": incidents
                }
        except Exception as e:
            print(f"[WARN] Error fetching project bundle from Supabase for {project_id}: {e}")

    # Fallback to stub bundle
    stub_project = next((p for p in SAMPLE_PROJECTS if p["project_id"] == project_id), None)
    if not stub_project:
        stub_project = {**SAMPLE_PROJECTS[0], "project_id": project_id}

    return {
        "project": stub_project,
        "parcels": SAMPLE_PARCELS.get(project_id, SAMPLE_PARCELS.get("PRJ-0001", [])),
        "cases": SAMPLE_CASES.get(project_id, SAMPLE_CASES.get("PRJ-0001", [])),
        "approvals": SAMPLE_APPROVALS.get(project_id, SAMPLE_APPROVALS.get("PRJ-0001", [])),
        "compensation": SAMPLE_COMPENSATION.get(project_id, SAMPLE_COMPENSATION.get("PRJ-0001", {})),
        "incidents": SAMPLE_INCIDENTS.get(project_id, SAMPLE_INCIDENTS.get("PRJ-0001", []))
    }


def fetch_district_past_delay_rate(district: Optional[str] = None) -> float:
    """
    Computes the historical delay rate for a district from the historical_projects table.
    If the historical_projects table is empty or query fails, returns a default of 0.3.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            # Query historical projects table
            res = supabase.table("historical_projects").select("is_delayed, district_past_delay_rate").limit(500).execute()
            if res.data and len(res.data) > 0:
                rates = [
                    float(row["district_past_delay_rate"])
                    for row in res.data
                    if row.get("district_past_delay_rate") is not None
                ]
                if rates:
                    return round(sum(rates) / len(rates), 3)

                is_del = [
                    1.0 if row.get("is_delayed") else 0.0
                    for row in res.data
                    if "is_delayed" in row
                ]
                if is_del:
                    return round(sum(is_del) / len(is_del), 3)
        except Exception as e:
            print(f"[WARN] Error fetching district delay rate from historical_projects: {e}")

    # District-specific defaults if known, otherwise default 0.3
    district_defaults = {
        "pune": 0.35,
        "thane": 0.45,
        "nagpur": 0.30,
        "nashik": 0.25,
        "solapur": 0.20
    }
    if district and district.lower() in district_defaults:
        return district_defaults[district.lower()]

    return 0.3
