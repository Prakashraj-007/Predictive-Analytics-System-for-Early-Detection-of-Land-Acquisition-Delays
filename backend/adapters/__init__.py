"""
Adapters package.

Public API
----------
fetch_external_bundle(project_id) -> dict
    Calls all five CSV adapters and returns a single bundle dict:
    {
        "parcels":      list[dict],   # land-record parcels
        "cases":        list[dict],   # court cases (via parcel IDs)
        "compensation": dict,         # compensation summary
        "approvals":    list[dict],   # departmental clearances
        "incidents":    list[dict],   # field incidents
    }

Individual adapters are also importable directly:
    from backend.adapters import CourtAdapter, LandRecordAdapter, ...
"""

from .approvals_adapter import ApprovalsAdapter
from .compensation_adapter import CompensationAdapter
from .court_adapter import CourtAdapter
from .incidents_adapter import IncidentsAdapter
from .land_record_adapter import LandRecordAdapter

__all__ = [
    "ApprovalsAdapter",
    "CompensationAdapter",
    "CourtAdapter",
    "IncidentsAdapter",
    "LandRecordAdapter",
    "fetch_external_bundle",
]

# ---------------------------------------------------------------------------
# Module-level singleton instances (one DataFrame cache per adapter type)
# ---------------------------------------------------------------------------
_land_adapter = LandRecordAdapter()
_court_adapter = CourtAdapter()
_comp_adapter = CompensationAdapter()
_approvals_adapter = ApprovalsAdapter()
_incidents_adapter = IncidentsAdapter()


def fetch_external_bundle(project_id: str) -> dict:
    """Fetch all external data for one project.

    This is the single entry-point used by Person A's prediction service.
    It calls all five adapters in sequence and returns a unified bundle.

    Parameters
    ----------
    project_id:
        The project identifier (e.g. ``"PRJ-0001"``).

    Returns
    -------
    dict with keys:
        * ``parcels``      — list[dict] from LandRecordAdapter
        * ``cases``        — list[dict] from CourtAdapter (filtered by parcel IDs)
        * ``compensation`` — dict from CompensationAdapter
        * ``approvals``    — list[dict] from ApprovalsAdapter
        * ``incidents``    — list[dict] from IncidentsAdapter
    """
    parcels = _land_adapter.get_parcels(project_id)

    parcel_ids = [p["parcel_id"] for p in parcels if p.get("parcel_id")]
    cases = _court_adapter.get_cases(parcel_ids)

    compensation = _comp_adapter.get_compensation(project_id)
    approvals = _approvals_adapter.get_approvals(project_id)
    incidents = _incidents_adapter.get_incidents(project_id)

    return {
        "parcels": parcels,
        "cases": cases,
        "compensation": compensation,
        "approvals": approvals,
        "incidents": incidents,
    }
