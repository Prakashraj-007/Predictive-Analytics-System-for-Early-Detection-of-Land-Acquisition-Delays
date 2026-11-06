"""
backend/core/features.py
========================
Feature builder for LandSentinel.

build_features(project, parcels, cases, approvals, compensation, incidents,
               district_past_delay_rate, *, as_of=None) -> dict

Pure function — no database, no file I/O, no side effects.
All 15 feature keys are always present in the returned dict;
missing/bad inputs degrade gracefully (None where documented, 0 elsewhere).

The 15 keys
-----------
1.  land_area_ha
2.  families_affected
3.  project_type
4.  current_stage
5.  rr_progress_pct
6.  litigation_cases
7.  stay_orders
8.  ownership_disputes
9.  compensation_pending_pct
10. approval_days_pending
11. docs_incomplete_pct
12. officer_response_days
13. encroached_area_pct
14. possession_pct
15. district_past_delay_rate
"""

from __future__ import annotations

from datetime import date
from typing import Any

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val: Any, default: float = 0.0) -> float:
    """Return float(val) or *default* on any error / None."""
    try:
        f = float(val)
        return f if f == f else default  # guard NaN
    except (TypeError, ValueError):
        return default


def _clip(val: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, val))


def _round1(val: float) -> float:
    return round(val, 1)


def _parse_date(date_str: str | None) -> date | None:
    """Parse an ISO date string (YYYY-MM-DD) → date, or None on error."""
    if not date_str:
        return None
    try:
        return date.fromisoformat(str(date_str).strip())
    except (ValueError, AttributeError):
        return None


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------

def build_features(
    project: dict,
    parcels: list[dict],
    cases: list[dict],
    approvals: list[dict],
    compensation: dict,
    incidents: list[dict],
    district_past_delay_rate: float,
    *,
    as_of: date | None = None,
) -> dict:
    """Compute the 15 feature dict from raw adapter data.

    Parameters
    ----------
    project:
        Project record dict (from the projects CSV / DB row).
    parcels:
        List of parcel dicts from LandRecordAdapter.
    cases:
        List of case dicts from CourtAdapter.
    approvals:
        List of approval dicts from ApprovalsAdapter.
    compensation:
        Compensation summary dict from CompensationAdapter.
    incidents:
        List of incident dicts from IncidentsAdapter.
    district_past_delay_rate:
        Historical delay rate for the district (passed in from the ML
        pipeline; stored here for the feature vector).
    as_of:
        Reference date for computing overdue days.  Defaults to
        ``date.today()``.  Pass an explicit date in tests to keep them
        deterministic.

    Returns
    -------
    dict
        Exactly the 15 keys listed in the module docstring.
        Percentages are rounded to 1 decimal place and clipped to [0, 100].
    """
    today: date
    if isinstance(as_of, str):
        parsed = _parse_date(as_of)
        today = parsed if parsed is not None else date.today()
    elif isinstance(as_of, date):
        today = as_of
    else:
        today = date.today()

    # ------------------------------------------------------------------
    # 1-5: Straight project fields
    # ------------------------------------------------------------------
    land_area_ha: float | None = _safe_float(project.get("land_area_ha")) or None
    families_affected: int | None = (
        int(_safe_float(project.get("families_affected")))
        if project.get("families_affected") is not None
        else None
    )
    project_type: str | None = project.get("type") or project.get("project_type") or None
    current_stage: str | None = project.get("current_stage") or None
    rr_progress_pct: float = _round1(
        _clip(_safe_float(project.get("rr_progress_pct")))
    )

    # ------------------------------------------------------------------
    # 6. litigation_cases — pending cases
    # ------------------------------------------------------------------
    pending_cases = [c for c in cases if c.get("status") == "pending"]
    litigation_cases: int = len(pending_cases)

    # ------------------------------------------------------------------
    # 7. stay_orders — pending cases with stay_order True
    # ------------------------------------------------------------------
    stay_orders: int = sum(
        1 for c in pending_cases if c.get("stay_order") is True
    )

    # ------------------------------------------------------------------
    # 8. ownership_disputes — disputed parcels + compensation disputes
    # ------------------------------------------------------------------
    parcel_disputes: int = sum(
        1 for p in parcels if p.get("ownership_dispute") is True
    )
    comp_disputes: int = int(_safe_float(compensation.get("disputes"))) if compensation else 0
    ownership_disputes: int = parcel_disputes + comp_disputes

    # ------------------------------------------------------------------
    # 9. compensation_pending_pct
    # ------------------------------------------------------------------
    award: float = _safe_float(compensation.get("award_amount") if compensation else 0)
    disbursed: float = _safe_float(compensation.get("disbursed_amount") if compensation else 0)
    if award > 0:
        compensation_pending_pct: float = _round1(
            _clip((award - disbursed) / award * 100)
        )
    else:
        compensation_pending_pct = 0.0

    # ------------------------------------------------------------------
    # 10. approval_days_pending — max overdue days among pending approvals
    # ------------------------------------------------------------------
    max_overdue: int = 0
    for apv in approvals:
        if apv.get("status") == "pending":
            planned = _parse_date(apv.get("planned_date"))
            if planned is not None:
                overdue = max(0, (today - planned).days)
                if overdue > max_overdue:
                    max_overdue = overdue
    approval_days_pending: int = max_overdue

    # ------------------------------------------------------------------
    # 11. docs_incomplete_pct
    # ------------------------------------------------------------------
    total_parcels: int = len(parcels)
    if total_parcels > 0:
        incomplete: int = sum(
            1 for p in parcels
            if p.get("doc_complete") is False or (p.get("documents_verified") is False and "doc_complete" not in p)
        )
        docs_incomplete_pct: float = _round1(incomplete / total_parcels * 100)
    else:
        docs_incomplete_pct = 0.0

    # ------------------------------------------------------------------
    # 12. officer_response_days (None if missing)
    # ------------------------------------------------------------------
    raw_ord = project.get("officer_response_days")
    officer_response_days: int | None = (
        int(_safe_float(raw_ord)) if raw_ord is not None else None
    )

    # ------------------------------------------------------------------
    # 13. encroached_area_pct
    # ------------------------------------------------------------------
    encroached_sum: float = sum(
        _safe_float(inc.get("encroached_area_ha"))
        for inc in incidents
        if inc.get("type") == "encroachment"
    )
    land_ha: float = _safe_float(project.get("land_area_ha"))
    if land_ha > 0:
        encroached_area_pct: float = _round1(_clip(encroached_sum / land_ha * 100))
    else:
        encroached_area_pct = 0.0

    # ------------------------------------------------------------------
    # 14. possession_pct — area_ha of handed-over parcels / total area
    # ------------------------------------------------------------------
    total_area: float = sum(_safe_float(p.get("area_ha")) for p in parcels)
    handed_area: float = sum(
        _safe_float(p.get("area_ha"))
        for p in parcels
        if p.get("possession_status") == "handed_over"
        or p.get("status") == "handed_over"
        or p.get("possession_handed_over") is True
        or p.get("possession_given") is True
    )
    if total_area > 0:
        possession_pct: float = _round1(_clip(handed_area / total_area * 100))
    else:
        possession_pct = 0.0

    # ------------------------------------------------------------------
    # 15. district_past_delay_rate — passed in as-is
    # ------------------------------------------------------------------
    dist_rate: float = _safe_float(district_past_delay_rate)

    return {
        "land_area_ha": land_area_ha,
        "families_affected": families_affected,
        "project_type": project_type,
        "current_stage": current_stage,
        "rr_progress_pct": rr_progress_pct,
        "litigation_cases": litigation_cases,
        "stay_orders": stay_orders,
        "ownership_disputes": ownership_disputes,
        "compensation_pending_pct": compensation_pending_pct,
        "approval_days_pending": approval_days_pending,
        "docs_incomplete_pct": docs_incomplete_pct,
        "officer_response_days": officer_response_days,
        "encroached_area_pct": encroached_area_pct,
        "possession_pct": possession_pct,
        "district_past_delay_rate": dist_rate,
    }


# ---------------------------------------------------------------------------
# Explainer
# ---------------------------------------------------------------------------

_EXPLANATIONS: dict[str, str] = {
    "land_area_ha": (
        "Total land area to be acquired (hectares). "
        "Larger projects are inherently harder to coordinate."
    ),
    "families_affected": (
        "Number of families requiring resettlement. "
        "Higher counts increase social complexity and legal risk."
    ),
    "project_type": (
        "Category of infrastructure project (highway, irrigation, power, etc.). "
        "Different types face different regulatory timelines."
    ),
    "current_stage": (
        "Current acquisition stage (planning → notification → award → "
        "compensation → possession). Later stages should see fewer pending issues."
    ),
    "rr_progress_pct": (
        "Percentage of resettlement & rehabilitation activities completed. "
        "Low progress here predicts possession and social-risk delays."
    ),
    "litigation_cases": (
        "Number of court cases with status 'pending'. "
        "Each pending case can independently block possession of a parcel."
    ),
    "stay_orders": (
        "Pending cases where a court stay order halts acquisition. "
        "Even a single stay order can freeze an entire parcel."
    ),
    "ownership_disputes": (
        "Combined count of parcels with disputed ownership plus "
        "compensation disputes. Unresolved disputes block mutation and payment."
    ),
    "compensation_pending_pct": (
        "Percentage of the total award amount still unpaid. "
        "High undisbursed compensation is a leading indicator of possession delay."
    ),
    "approval_days_pending": (
        "Maximum number of days any required departmental clearance is overdue. "
        "Stalled approvals are a primary bureaucratic delay driver."
    ),
    "docs_incomplete_pct": (
        "Percentage of parcels with incomplete documentation. "
        "Incomplete docs prevent registration, award, and possession."
    ),
    "officer_response_days": (
        "Average days taken by the nodal officer to respond to file movements. "
        "High response time signals administrative bottlenecks."
    ),
    "encroached_area_pct": (
        "Percentage of total project land covered by encroachment incidents. "
        "Encroachments require eviction proceedings, adding weeks to possession."
    ),
    "possession_pct": (
        "Percentage of parcel area (by ha) already handed over for construction. "
        "Low possession despite late stage indicates accumulated delays."
    ),
    "district_past_delay_rate": (
        "Historical average delay rate for completed projects in the same district. "
        "Districts with a history of delays tend to repeat them."
    ),
}


def explain_features(features: dict) -> dict:
    """Return a dict of the same keys mapped to human-readable explanations.

    Used by the UI to show tooltips / help text alongside each feature value.

    Parameters
    ----------
    features:
        The dict returned by ``build_features()``.

    Returns
    -------
    dict
        Same keys as *features*, values are explanation strings.
        Unknown keys get a generic explanation.
    """
    result: dict = {}
    for key in features:
        result[key] = _EXPLANATIONS.get(
            key, f"Feature '{key}': review with the project team."
        )
    return result
