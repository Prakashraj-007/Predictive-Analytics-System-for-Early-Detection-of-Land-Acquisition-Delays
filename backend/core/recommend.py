"""
backend/core/recommend.py
=========================
Recommendation rule engine for LandSentinel.

The module defines a static RULES list – each entry is a dict with the
following fields (as required by the spec):

    feature: str                     # the driver name (must match one of the 15 feature keys)
    min_value_hint: float | None    # optional lower‑bound hint used by the UI (not used by recommend())
    action: str                      # human‑readable recommendation text
    owner_role: str                  # role that should act on the recommendation
    priority: int                    # numeric priority (lower = higher priority)
    expected_effect: str             # short description of the expected impact

The ``recommend(drivers)`` function receives a list of driver dictionaries, e.g.:

    [{"driver": "compensation_pending_pct", "direction": "increases_risk", "value": 73}, ...]

Only drivers whose ``direction`` is ``"increases_risk"`` are considered.
For each such driver the matching rule (by ``feature``) is looked up.  If the
rule contains a ``min_value_hint`` the rule is still used – the spec states the
value hint is optional and should not affect selection.  The returned list is
ordered exactly as the input drivers list; each element is a dict with the
keys ``driver`` and ``action``.

If a driver references an unknown feature a generic fallback action is
produced.

A helper ``rules_table()`` returns the raw RULES list – this can be rendered
by a documentation script into ``docs/recommendation_rules.md``.
"""

from __future__ import annotations

from typing import List, Dict, Any

# ---------------------------------------------------------------------------
# Static rule definitions (12‑15 rules covering the 15 features)
# ---------------------------------------------------------------------------

RULES: List[Dict[str, Any]] = [
    # 1. compensation_pending_pct
    {
        "feature": "compensation_pending_pct",
        "min_value_hint": None,
        "action": "Release pending funds and hold payment camps for landowners.",
        "owner_role": "finance",
        "priority": 1,
        "expected_effect": "Reduces payment delays and improves possession rates",
    },
    # 2. litigation_cases & stay_orders – combined rule (same action)
    {
        "feature": "litigation_cases",
        "min_value_hint": 1,
        "action": "Escalate the cases to the legal cell, consider a special Lok Adalat and seek early hearings.",
        "owner_role": "legal",
        "priority": 2,
        "expected_effect": "Accelerates case resolution, lowering possession bottlenecks",
    },
    {
        "feature": "stay_orders",
        "min_value_hint": 1,
        "action": "Escalate the cases to the legal cell, consider a special Lok Adalat and seek early hearings.",
        "owner_role": "legal",
        "priority": 2,
        "expected_effect": "Same as litigation_cases",
    },
    # 3. approval_days_pending
    {
        "feature": "approval_days_pending",
        "min_value_hint": 30,
        "action": "Escalate to the department head and set a deadline for the pending approval.",
        "owner_role": "admin",
        "priority": 3,
        "expected_effect": "Reduces bureaucratic lag",
    },
    # 4. docs_incomplete_pct
    {
        "feature": "docs_incomplete_pct",
        "min_value_hint": 10,
        "action": "Run a documentation drive and verify land records.",
        "owner_role": "records",
        "priority": 4,
        "expected_effect": "Ensures clean titles and smooth mutations",
    },
    # 5. encroached_area_pct
    {
        "feature": "encroached_area_pct",
        "min_value_hint": 5,
        "action": "Plan an eviction and clearance drive with the local administration.",
        "owner_role": "security",
        "priority": 5,
        "expected_effect": "Reclaims project land, preventing further delays",
    },
    # 6. rr_progress_pct
    {
        "feature": "rr_progress_pct",
        "min_value_hint": 20,
        "action": "Speed up resettlement site development and housing allotment.",
        "owner_role": "rr",
        "priority": 6,
        "expected_effect": "Improves community acceptance and speeds possession",
    },
    # 7. ownership_disputes
    {
        "feature": "ownership_disputes",
        "min_value_hint": 1,
        "action": "Hold a joint hearing with the revenue officer and speed up mutation of disputed parcels.",
        "owner_role": "revenue",
        "priority": 7,
        "expected_effect": "Clears title issues, enabling award and possession",
    },
    # 8. officer_response_days
    {
        "feature": "officer_response_days",
        "min_value_hint": 7,
        "action": "Set a file‑movement time limit (for example 7 days) and track delays weekly.",
        "owner_role": "officer",
        "priority": 8,
        "expected_effect": "Improves administrative throughput",
    },
    # 9. possession_pct
    {
        "feature": "possession_pct",
        "min_value_hint": 30,
        "action": "Hold a possession camp parcel by parcel with the village administration.",
        "owner_role": "field",
        "priority": 9,
        "expected_effect": "Directly raises possession percentage",
    },
    # 10. district_past_delay_rate
    {
        "feature": "district_past_delay_rate",
        "min_value_hint": 0.2,
        "action": "Review the district's past delay causes and add a monthly review meeting.",
        "owner_role": "pm",
        "priority": 10,
        "expected_effect": "Learns from history, prevents repeat delays",
    },
    # 11‑13. Generic fallbacks for remaining project‑level fields
    {
        "feature": "land_area_ha",
        "min_value_hint": None,
        "action": "Split the project into phases to manage larger land scopes.",
        "owner_role": "pm",
        "priority": 11,
        "expected_effect": "Reduces coordination complexity",
    },
    {
        "feature": "families_affected",
        "min_value_hint": None,
        "action": "Appoint a dedicated resettlement officer to handle large beneficiary numbers.",
        "owner_role": "pm",
        "priority": 12,
        "expected_effect": "Improves stakeholder engagement",
    },
    {
        "feature": "project_type",
        "min_value_hint": None,
        "action": "Tailor project‑specific SOPs – e.g., highways need right‑of‑way clearances early.",
        "owner_role": "pm",
        "priority": 13,
        "expected_effect": "Ensures type‑appropriate risk mitigation",
    },
    {
        "feature": "current_stage",
        "min_value_hint": None,
        "action": "Conduct a stage‑gate review to identify bottlenecks before moving forward.",
        "owner_role": "pm",
        "priority": 14,
        "expected_effect": "Pre‑emptively catches delays",
    },
]

# ---------------------------------------------------------------------------
# Core recommendation logic
# ---------------------------------------------------------------------------

def _lookup_rule(feature: str) -> Dict[str, Any] | None:
    for rule in RULES:
        if rule["feature"] == feature:
            return rule
    return None


def recommend(drivers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return a list of recommendation dicts based on driver risk drivers.

    The input ``drivers`` is a list of dictionaries with either ``feature`` or
    ``driver``, plus optional ``direction``, ``label``, and ``impact``.

    Only drivers with ``direction == "increases_risk"`` (or non-negative impact
    when direction is omitted) are processed.
    For each such driver we find the first matching RULE (by ``feature``).
    If a rule exists we emit ``{"driver": feature, "action": rule["action"]}``.
    Unknown drivers yield a generic fallback action.
    The order of the output list matches the order of the input ``drivers``.
    At most one action is emitted per driver.
    """
    recommendations: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for d in drivers:
        # Skip if explicitly marked as decreasing risk
        if d.get("direction") == "decreases_risk":
            continue
        # If direction omitted but impact is negative or zero, skip
        if "direction" not in d and d.get("impact") is not None and d.get("impact", 0) <= 0:
            continue

        feature = d.get("feature") or d.get("driver")
        if not feature or feature in seen:
            continue
        seen.add(feature)

        rule = _lookup_rule(feature)
        if rule:
            recommendations.append({"driver": feature, "action": rule["action"]})
        else:
            # Generic fallback for unknown feature
            recommendations.append({
                "driver": feature,
                "action": "Review this factor with the project team.",
            })
    return recommendations


def rules_table() -> List[Dict[str, Any]]:
    """Return the RULES list – useful for documentation generators.

    The function is deliberately tiny; callers can format the output however they
    like (e.g., markdown table, CSV, JSON).  Keeping it separate avoids importing
    the RULES constant directly which may be considered an implementation detail.
    """
    return RULES

# ---------------------------------------------------------------------------
# End of module
# ---------------------------------------------------------------------------
