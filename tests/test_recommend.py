"""
tests/test_recommend.py
=======================
Pytest suite for backend/core/recommend.py

The spec requires:
  * Every one of the 15 feature keys appears in RULES (or a generic fallback).
  * ``recommend(drivers)`` returns recommendations only for drivers with
    ``direction == 'increases_risk'``.
  * Output order matches input driver order.
  * At most one action per driver.
  * Unknown features get the generic fallback action.
"""

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.core.recommend import RULES, recommend, rules_table

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

EXPECTED_FEATURES = {
    "land_area_ha",
    "families_affected",
    "project_type",
    "current_stage",
    "rr_progress_pct",
    "litigation_cases",
    "stay_orders",
    "ownership_disputes",
    "compensation_pending_pct",
    "approval_days_pending",
    "docs_incomplete_pct",
    "officer_response_days",
    "encroached_area_pct",
    "possession_pct",
    "district_past_delay_rate",
}

# ---------------------------------------------------------------------------
# Test that RULES covers every feature (or has a generic fallback)
# ---------------------------------------------------------------------------

def test_rules_cover_all_features():
    rule_features = {r["feature"] for r in RULES}
    missing = EXPECTED_FEATURES - rule_features
    # It's acceptable for a feature to be covered by a *combined* rule (e.g.
    # litigation_cases + stay_orders share the same action but appear as
    # separate entries).  The spec says each feature must be covered at least
    # once, so we assert that the set difference is empty.
    assert not missing, f"Features missing from RULES: {sorted(missing)}"

# ---------------------------------------------------------------------------
# Core recommendation logic
# ---------------------------------------------------------------------------

def test_recommend_returns_only_increases_risk():
    drivers = [
        {"driver": "compensation_pending_pct", "direction": "increases_risk"},
        {"driver": "rr_progress_pct", "direction": "decreases_risk"},
    ]
    recs = recommend(drivers)
    assert len(recs) == 1
    assert recs[0]["driver"] == "compensation_pending_pct"

def test_recommend_preserves_input_order():
    drivers = [
        {"driver": "officer_response_days", "direction": "increases_risk"},
        {"driver": "approval_days_pending", "direction": "increases_risk"},
        {"driver": "stay_orders", "direction": "increases_risk"},
    ]
    recs = recommend(drivers)
    assert [r["driver"] for r in recs] == [
        "officer_response_days",
        "approval_days_pending",
        "stay_orders",
    ]

def test_recommend_unknown_feature_fallback():
    drivers = [
        {"driver": "nonexistent_feature", "direction": "increases_risk"},
    ]
    recs = recommend(drivers)
    assert recs[0]["action"] == "Review this factor with the project team."

def test_recommend_at_most_one_action_per_driver():
    # Even if multiple RULES entries share the same feature, recommend should
    # emit only one dict per driver – we achieve this by returning the first
    # matched rule (our implementation already does that).
    drivers = [
        {"driver": "litigation_cases", "direction": "increases_risk"},
        {"driver": "stay_orders", "direction": "increases_risk"},
    ]
    recs = recommend(drivers)
    assert len(recs) == 2
    for rec in recs:
        assert isinstance(rec["action"], str) and len(rec["action"]) > 10

def test_rules_table_returns_same_object_as_RULES():
    assert rules_table() is RULES

# ---------------------------------------------------------------------------
# Exhaustive driver list test – each known feature once
# ---------------------------------------------------------------------------

def test_recommend_all_features_increasing():
    drivers = [{"driver": f, "direction": "increases_risk"} for f in sorted(EXPECTED_FEATURES)]
    recs = recommend(drivers)
    # Should return exactly one recommendation per driver
    assert len(recs) == len(EXPECTED_FEATURES)
    # Verify that each driver appears in the output in the same order
    assert [r["driver"] for r in recs] == [d["driver"] for d in drivers]
    # Ensure the actions are non‑empty strings
    for rec in recs:
        assert isinstance(rec["action"], str) and len(rec["action"]) > 0
