"""
tests/test_features.py
======================
Pytest tests for backend/core/features.py

Includes the worked example from the spec:
  - 120 ha, 800 families, highway
  - 9 pending cases, 2 with stay_order=True
  - award=100, disbursed=59  → compensation_pending_pct = 41.0
  - 1 approval 120 days overdue
  - encroachment incidents covering 8% of land
  - officer_response_days = 22

Run:
    pytest tests/test_features.py -v
"""

from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.core.features import build_features, explain_features

# ---------------------------------------------------------------------------
# Shared fixtures / helpers
# ---------------------------------------------------------------------------

TODAY = date(2025, 6, 1)  # fixed reference date for all tests


def _project(**kwargs) -> dict:
    """Minimal project dict, overridable with kwargs."""
    defaults = {
        "land_area_ha": 120,
        "families_affected": 800,
        "type": "highway",
        "current_stage": "possession",
        "rr_progress_pct": 24,
        "officer_response_days": 22,
    }
    defaults.update(kwargs)
    return defaults


def _cases(n_pending: int = 9, n_stayed: int = 2, n_disposed: int = 3) -> list[dict]:
    """Build a list of case dicts."""
    cases = []
    for i in range(n_pending):
        cases.append({
            "case_id": f"CAS-{i:05d}",
            "parcel_id": "PAR-001",
            "category": "land acquisition",
            "filing_date": "2023-01-01",
            "status": "pending",
            "stay_order": i < n_stayed,
            "hearings": 3,
        })
    for i in range(n_disposed):
        cases.append({
            "case_id": f"CAS-DISP-{i:05d}",
            "parcel_id": "PAR-001",
            "category": "land acquisition",
            "filing_date": "2022-01-01",
            "status": "disposed",
            "stay_order": False,
            "hearings": 10,
        })
    return cases


def _parcels(n: int = 10, disputed: int = 2, incomplete: int = 3,
             handed_over_pct: float = 0.6) -> list[dict]:
    """Build parcel dicts with controllable attributes."""
    parcels = []
    handed = int(n * handed_over_pct)
    for i in range(n):
        parcels.append({
            "parcel_id": f"PAR-{i:03d}",
            "project_id": "PRJ-0001",
            "area_ha": 12.0,   # 10 × 12 = 120 ha total
            "land_type": "private",
            "compensation_status": "pending",
            "possession_status": "handed_over" if i < handed else "pending",
            "doc_complete": i >= incomplete,  # first `incomplete` are incomplete
            "ownership_dispute": i < disputed,
        })
    return parcels


def _compensation(award: float = 100, disbursed: float = 59, disputes: int = 1) -> dict:
    return {
        "project_id": "PRJ-0001",
        "award_amount": award,
        "disbursed_amount": disbursed,
        "disputes": disputes,
    }


def _approvals(overdue_days: int = 120, n_cleared: int = 2) -> list[dict]:
    """One pending approval overdue by `overdue_days`, plus cleared ones."""
    planned = TODAY - timedelta(days=overdue_days)
    apvs = [
        {
            "approval_id": "APP-001",
            "project_id": "PRJ-0001",
            "name": "award_approval",
            "planned_date": planned.isoformat(),
            "actual_date": None,
            "status": "pending",
        }
    ]
    for i in range(n_cleared):
        apvs.append({
            "approval_id": f"APP-CLR-{i}",
            "project_id": "PRJ-0001",
            "name": "survey_clearance",
            "planned_date": "2024-01-01",
            "actual_date": "2024-03-01",
            "status": "cleared",
        })
    return apvs


def _incidents(encroach_ha: float = 9.6, n_obstructions: int = 2) -> list[dict]:
    """encroach_ha / 120 ha = 8%."""
    incs = [
        {
            "incident_id": "INC-001",
            "project_id": "PRJ-0001",
            "type": "encroachment",
            "incident_date": "2024-05-01",
            "encroached_area_ha": encroach_ha,
        }
    ]
    for i in range(n_obstructions):
        incs.append({
            "incident_id": f"INC-OBS-{i}",
            "project_id": "PRJ-0001",
            "type": "obstruction",
            "incident_date": "2024-06-01",
            "encroached_area_ha": 5.0,  # obstructions NOT counted in pct
        })
    return incs


# ---------------------------------------------------------------------------
# Worked example (from spec)
# ---------------------------------------------------------------------------

class TestWorkedExample:
    """
    Spec worked example:
      120 ha, 800 families, 9 pending cases (2 stayed),
      award 100 / disbursed 59  → 41% pending,
      1 approval 120 days overdue,
      8% encroached, officer_response 22 days.
    """

    @pytest.fixture
    def features(self):
        return build_features(
            project=_project(),
            parcels=_parcels(),
            cases=_cases(),
            approvals=_approvals(overdue_days=120),
            compensation=_compensation(award=100, disbursed=59),
            incidents=_incidents(encroach_ha=9.6),
            district_past_delay_rate=0.35,
            as_of=TODAY,
        )

    def test_land_area_ha(self, features):
        assert features["land_area_ha"] == 120.0

    def test_families_affected(self, features):
        assert features["families_affected"] == 800

    def test_project_type(self, features):
        assert features["project_type"] == "highway"

    def test_current_stage(self, features):
        assert features["current_stage"] == "possession"

    def test_rr_progress_pct(self, features):
        assert features["rr_progress_pct"] == 24.0

    def test_litigation_cases(self, features):
        assert features["litigation_cases"] == 9

    def test_stay_orders(self, features):
        assert features["stay_orders"] == 2

    def test_ownership_disputes(self, features):
        # 2 disputed parcels + 1 comp dispute = 3
        assert features["ownership_disputes"] == 3

    def test_compensation_pending_pct(self, features):
        # (100 - 59) / 100 * 100 = 41.0
        assert features["compensation_pending_pct"] == 41.0

    def test_approval_days_pending(self, features):
        assert features["approval_days_pending"] == 120

    def test_docs_incomplete_pct(self, features):
        # 3 incomplete out of 10 = 30.0%
        assert features["docs_incomplete_pct"] == 30.0

    def test_officer_response_days(self, features):
        assert features["officer_response_days"] == 22

    def test_encroached_area_pct(self, features):
        # 9.6 / 120 * 100 = 8.0%
        assert features["encroached_area_pct"] == 8.0

    def test_possession_pct(self, features):
        # 6 out of 10 handed over, each 12 ha → 60.0%
        assert features["possession_pct"] == 60.0

    def test_district_past_delay_rate(self, features):
        assert features["district_past_delay_rate"] == 0.35


# ---------------------------------------------------------------------------
# Return-shape tests
# ---------------------------------------------------------------------------

class TestReturnShape:
    EXPECTED_KEYS = {
        "land_area_ha", "families_affected", "project_type", "current_stage",
        "rr_progress_pct", "litigation_cases", "stay_orders", "ownership_disputes",
        "compensation_pending_pct", "approval_days_pending", "docs_incomplete_pct",
        "officer_response_days", "encroached_area_pct", "possession_pct",
        "district_past_delay_rate",
    }

    def _build(self, **kwargs):
        return build_features(
            project=_project(**kwargs.get("project_kw", {})),
            parcels=kwargs.get("parcels", _parcels()),
            cases=kwargs.get("cases", _cases()),
            approvals=kwargs.get("approvals", _approvals()),
            compensation=kwargs.get("compensation", _compensation()),
            incidents=kwargs.get("incidents", _incidents()),
            district_past_delay_rate=kwargs.get("rate", 0.2),
            as_of=TODAY,
        )

    def test_exactly_15_keys(self):
        features = self._build()
        assert set(features.keys()) == self.EXPECTED_KEYS

    def test_all_keys_present_empty_inputs(self):
        features = build_features(
            project={}, parcels=[], cases=[], approvals=[],
            compensation={}, incidents=[], district_past_delay_rate=0,
            as_of=TODAY,
        )
        assert set(features.keys()) == self.EXPECTED_KEYS

    def test_never_raises_with_empty_inputs(self):
        """build_features must not raise regardless of empty/None values."""
        build_features(
            project={}, parcels=[], cases=[], approvals=[],
            compensation={}, incidents=[], district_past_delay_rate=0,
            as_of=TODAY,
        )

    def test_missing_project_fields_dont_raise(self):
        build_features(
            project={"land_area_ha": None},
            parcels=[], cases=[], approvals=[],
            compensation={}, incidents=[], district_past_delay_rate=0,
            as_of=TODAY,
        )


# ---------------------------------------------------------------------------
# Edge cases per feature
# ---------------------------------------------------------------------------

class TestEdgeCases:

    def _build(self, **kwargs):
        return build_features(
            project=kwargs.get("project", _project()),
            parcels=kwargs.get("parcels", _parcels()),
            cases=kwargs.get("cases", _cases()),
            approvals=kwargs.get("approvals", _approvals()),
            compensation=kwargs.get("compensation", _compensation()),
            incidents=kwargs.get("incidents", _incidents()),
            district_past_delay_rate=kwargs.get("rate", 0.2),
            as_of=TODAY,
        )

    # --- compensation_pending_pct ---
    def test_comp_pending_zero_award_returns_zero(self):
        f = self._build(compensation={"award_amount": 0, "disbursed_amount": 0, "disputes": 0})
        assert f["compensation_pending_pct"] == 0.0

    def test_comp_pending_missing_comp_returns_zero(self):
        f = self._build(compensation={})
        assert f["compensation_pending_pct"] == 0.0

    def test_comp_pending_clipped_to_100(self):
        # disbursed > award → pending could be negative, clip to 0
        f = self._build(compensation={"award_amount": 50, "disbursed_amount": 60, "disputes": 0})
        assert f["compensation_pending_pct"] == 0.0

    def test_comp_pending_full_disbursed(self):
        f = self._build(compensation={"award_amount": 100, "disbursed_amount": 100, "disputes": 0})
        assert f["compensation_pending_pct"] == 0.0

    # --- litigation_cases ---
    def test_no_cases_returns_zero(self):
        f = self._build(cases=[])
        assert f["litigation_cases"] == 0
        assert f["stay_orders"] == 0

    def test_all_disposed_returns_zero_pending(self):
        cases = _cases(n_pending=0, n_stayed=0, n_disposed=5)
        f = self._build(cases=cases)
        assert f["litigation_cases"] == 0

    def test_stay_orders_only_counts_pending(self):
        # Stay on disposed case should NOT count
        cases = [
            {"status": "disposed", "stay_order": True},
            {"status": "pending", "stay_order": True},
            {"status": "pending", "stay_order": False},
        ]
        f = self._build(cases=cases)
        assert f["stay_orders"] == 1
        assert f["litigation_cases"] == 2

    # --- approval_days_pending ---
    def test_no_pending_approvals_returns_zero(self):
        apvs = _approvals(overdue_days=120)
        apvs[0]["status"] = "cleared"
        apvs[0]["actual_date"] = "2024-01-01"
        f = self._build(approvals=apvs)
        assert f["approval_days_pending"] == 0

    def test_multiple_approvals_returns_max(self):
        apvs = [
            {"status": "pending", "planned_date": (TODAY - timedelta(days=30)).isoformat()},
            {"status": "pending", "planned_date": (TODAY - timedelta(days=90)).isoformat()},
            {"status": "pending", "planned_date": (TODAY - timedelta(days=200)).isoformat()},
        ]
        f = self._build(approvals=apvs)
        assert f["approval_days_pending"] == 200

    def test_future_planned_date_clipped_to_zero(self):
        apvs = [
            {"status": "pending", "planned_date": (TODAY + timedelta(days=30)).isoformat()},
        ]
        f = self._build(approvals=apvs)
        assert f["approval_days_pending"] == 0

    def test_empty_approvals_returns_zero(self):
        f = self._build(approvals=[])
        assert f["approval_days_pending"] == 0

    # --- docs_incomplete_pct ---
    def test_all_complete_returns_zero(self):
        parcels = [{"doc_complete": True, "possession_status": "pending",
                    "area_ha": 10, "ownership_dispute": False}] * 5
        f = self._build(parcels=parcels)
        assert f["docs_incomplete_pct"] == 0.0

    def test_no_parcels_returns_zero(self):
        f = self._build(parcels=[])
        assert f["docs_incomplete_pct"] == 0.0

    def test_all_incomplete_returns_100(self):
        parcels = [{"doc_complete": False, "possession_status": "pending",
                    "area_ha": 10, "ownership_dispute": False}] * 4
        f = self._build(parcels=parcels)
        assert f["docs_incomplete_pct"] == 100.0

    # --- encroached_area_pct ---
    def test_no_encroachment_incidents_returns_zero(self):
        # only obstructions
        incs = [{"type": "obstruction", "encroached_area_ha": 50.0}]
        f = self._build(incidents=incs)
        assert f["encroached_area_pct"] == 0.0

    def test_encroach_clipped_to_100(self):
        # encroached more than total land area
        incs = [{"type": "encroachment", "encroached_area_ha": 9999.0}]
        f = self._build(incidents=incs)
        assert f["encroached_area_pct"] == 100.0

    def test_zero_land_area_encroach_zero(self):
        f = self._build(
            project=_project(land_area_ha=0),
            incidents=[{"type": "encroachment", "encroached_area_ha": 10.0}],
        )
        assert f["encroached_area_pct"] == 0.0

    # --- possession_pct ---
    def test_all_handed_over(self):
        parcels = [{"possession_status": "handed_over", "area_ha": 10,
                    "doc_complete": True, "ownership_dispute": False}] * 5
        f = self._build(parcels=parcels)
        assert f["possession_pct"] == 100.0

    def test_none_handed_over(self):
        parcels = [{"possession_status": "pending", "area_ha": 10,
                    "doc_complete": True, "ownership_dispute": False}] * 5
        f = self._build(parcels=parcels)
        assert f["possession_pct"] == 0.0

    # --- officer_response_days ---
    def test_officer_response_none_when_missing(self):
        f = self._build(project=_project(officer_response_days=None))
        # project dict has key but value is None
        p = {k: v for k, v in _project().items() if k != "officer_response_days"}
        f2 = build_features(
            project=p, parcels=_parcels(), cases=_cases(),
            approvals=_approvals(), compensation=_compensation(),
            incidents=_incidents(), district_past_delay_rate=0.2,
            as_of=TODAY,
        )
        assert f2["officer_response_days"] is None

    # --- percentages ---
    def test_rr_progress_clipped_to_100(self):
        f = self._build(project=_project(rr_progress_pct=150))
        assert f["rr_progress_pct"] == 100.0

    def test_rr_progress_clipped_to_0(self):
        f = self._build(project=_project(rr_progress_pct=-10))
        assert f["rr_progress_pct"] == 0.0

    # --- ownership_disputes ---
    def test_ownership_disputes_adds_comp_disputes(self):
        parcels = _parcels(disputed=3)
        comp = _compensation(disputes=5)
        f = self._build(parcels=parcels, compensation=comp)
        assert f["ownership_disputes"] == 8  # 3 + 5

    def test_ownership_disputes_zero_when_no_disputes(self):
        parcels = _parcels(disputed=0)
        comp = _compensation(disputes=0)
        f = self._build(parcels=parcels, compensation=comp)
        assert f["ownership_disputes"] == 0

    # --- type coercion ---
    def test_string_numbers_parsed_correctly(self):
        """Adapter data may return numeric fields as strings."""
        f = build_features(
            project={
                "land_area_ha": "120",
                "families_affected": "800",
                "type": "highway",
                "current_stage": "possession",
                "rr_progress_pct": "24",
                "officer_response_days": "22",
            },
            parcels=_parcels(),
            cases=_cases(),
            approvals=_approvals(overdue_days=120),
            compensation=_compensation(award=100, disbursed=59),
            incidents=_incidents(encroach_ha=9.6),
            district_past_delay_rate=0.35,
            as_of=TODAY,
        )
        assert f["land_area_ha"] == 120.0
        assert f["families_affected"] == 800
        assert f["litigation_cases"] == 9

    def test_as_of_defaults_to_today(self):
        """Calling without as_of should not raise."""
        f = build_features(
            project=_project(), parcels=_parcels(), cases=_cases(),
            approvals=_approvals(), compensation=_compensation(),
            incidents=_incidents(), district_past_delay_rate=0.2,
        )
        assert "approval_days_pending" in f


# ---------------------------------------------------------------------------
# explain_features
# ---------------------------------------------------------------------------

class TestExplainFeatures:
    EXPECTED_KEYS = {
        "land_area_ha", "families_affected", "project_type", "current_stage",
        "rr_progress_pct", "litigation_cases", "stay_orders", "ownership_disputes",
        "compensation_pending_pct", "approval_days_pending", "docs_incomplete_pct",
        "officer_response_days", "encroached_area_pct", "possession_pct",
        "district_past_delay_rate",
    }

    def test_explain_returns_same_keys_as_features(self):
        features = build_features(
            project=_project(), parcels=_parcels(), cases=_cases(),
            approvals=_approvals(), compensation=_compensation(),
            incidents=_incidents(), district_past_delay_rate=0.2,
            as_of=TODAY,
        )
        explanation = explain_features(features)
        assert set(explanation.keys()) == set(features.keys())

    def test_all_explanations_are_strings(self):
        features = build_features(
            project=_project(), parcels=_parcels(), cases=_cases(),
            approvals=_approvals(), compensation=_compensation(),
            incidents=_incidents(), district_past_delay_rate=0.2,
            as_of=TODAY,
        )
        explanation = explain_features(features)
        for key, text in explanation.items():
            assert isinstance(text, str) and len(text) > 10, (
                f"Explanation for '{key}' is too short: {text!r}"
            )

    def test_unknown_key_gets_generic_explanation(self):
        explanation = explain_features({"totally_unknown_key": 42})
        assert "totally_unknown_key" in explanation["totally_unknown_key"]

    def test_all_15_standard_keys_have_explanations(self):
        features = {k: None for k in self.EXPECTED_KEYS}
        explanation = explain_features(features)
        for key in self.EXPECTED_KEYS:
            assert key in explanation
            assert "review" not in explanation[key].lower() or len(explanation[key]) > 30
