"""
tests/test_adapters.py
======================
Pytest tests for backend/adapters/.

Data source: data/sample_tiny/ (5 projects, real schema).
All tests set DATA_DIR to "data/sample_tiny" so they never touch the
larger "data/ongoing" or "data/ongoing_quick" datasets.

Run:
    pytest tests/test_adapters.py -v
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Make sure `backend` is importable when running from repo root
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

TINY_DIR = str(REPO_ROOT / "data" / "sample_tiny")

# ---------------------------------------------------------------------------
# Fixture: point every adapter at sample_tiny and reset cache after each test
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def use_sample_tiny(monkeypatch, tmp_path):
    """Override DATA_DIR to sample_tiny for all tests and clear adapter caches."""
    monkeypatch.setenv("DATA_DIR", TINY_DIR)
    yield
    # Clear adapter singleton caches after each test
    from backend.adapters import (
        _approvals_adapter,
        _comp_adapter,
        _court_adapter,
        _incidents_adapter,
        _land_adapter,
    )
    for adapter in [
        _land_adapter,
        _court_adapter,
        _comp_adapter,
        _approvals_adapter,
        _incidents_adapter,
    ]:
        adapter.clear_cache()


# ===========================================================================
# 1. CsvAdapter base
# ===========================================================================


class TestCsvAdapterBase:
    def test_missing_csv_raises_file_not_found(self, monkeypatch, tmp_path):
        """A clear FileNotFoundError should be raised naming the missing CSV."""
        monkeypatch.setenv("DATA_DIR", str(tmp_path))  # empty dir
        from backend.adapters.land_record_adapter import LandRecordAdapter

        adapter = LandRecordAdapter()
        with pytest.raises(FileNotFoundError, match="parcels.csv"):
            adapter.rows()

    def test_error_message_names_missing_file(self, monkeypatch, tmp_path):
        monkeypatch.setenv("DATA_DIR", str(tmp_path))
        from backend.adapters.court_adapter import CourtAdapter

        adapter = CourtAdapter()
        with pytest.raises(FileNotFoundError) as exc_info:
            adapter.rows()
        assert "cases.csv" in str(exc_info.value)

    def test_rows_returns_list_of_dicts(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        adapter = LandRecordAdapter()
        rows = adapter.rows()
        assert isinstance(rows, list)
        assert len(rows) > 0
        assert isinstance(rows[0], dict)

    def test_nan_converted_to_none(self):
        """actual_date is blank for pending approvals → should be None."""
        from backend.adapters.approvals_adapter import ApprovalsAdapter

        adapter = ApprovalsAdapter()
        rows = adapter.rows()
        # Find a row where actual_date is empty
        pending = [r for r in rows if r.get("status") == "pending"]
        assert pending, "Expected at least one pending approval"
        for row in pending:
            # actual_date column exists and should be None for pending rows
            assert "actual_date" in row
            assert row["actual_date"] is None, (
                f"Expected None for actual_date but got {row['actual_date']!r}"
            )

    def test_boolean_strings_coerced(self):
        """doc_complete and ownership_dispute should be Python bools, not strings."""
        from backend.adapters.land_record_adapter import LandRecordAdapter

        adapter = LandRecordAdapter()
        rows = adapter.rows()
        for row in rows:
            assert isinstance(row["doc_complete"], bool), (
                f"doc_complete should be bool, got {type(row['doc_complete'])}"
            )
            assert isinstance(row["ownership_dispute"], bool), (
                f"ownership_dispute should be bool, got {type(row['ownership_dispute'])}"
            )

    def test_filter_by_column(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        adapter = LandRecordAdapter()
        rows = adapter.rows(filter={"project_id": "PRJ-0001"})
        assert all(r["project_id"] == "PRJ-0001" for r in rows)
        assert len(rows) == 39  # sample_tiny has 39 parcels for PRJ-0001

    def test_filter_unknown_column_returns_empty(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        adapter = LandRecordAdapter()
        rows = adapter.rows(filter={"nonexistent_col": "x"})
        assert rows == []

    def test_clear_cache_reloads(self, monkeypatch, tmp_path):
        """After clear_cache(), the adapter should reload from disk."""
        import shutil

        # Copy sample_tiny to tmp so we can modify it
        src = Path(TINY_DIR)
        dst = tmp_path / "data"
        shutil.copytree(src, dst)
        monkeypatch.setenv("DATA_DIR", str(dst))

        from backend.adapters.land_record_adapter import LandRecordAdapter

        adapter = LandRecordAdapter()
        rows_before = adapter.rows()
        count_before = len(rows_before)

        # Truncate the file to header only
        parcel_file = dst / "parcels.csv"
        with open(parcel_file, "r") as f:
            header = f.readline()
        with open(parcel_file, "w") as f:
            f.write(header)

        # Without clearing cache, still returns old data
        assert len(adapter.rows()) == count_before

        # After clear_cache(), returns new (empty) data
        adapter.clear_cache()
        assert len(adapter.rows()) == 0


# ===========================================================================
# 2. LandRecordAdapter
# ===========================================================================


class TestLandRecordAdapter:
    def test_get_parcels_returns_list(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        parcels = LandRecordAdapter().get_parcels("PRJ-0001")
        assert isinstance(parcels, list)
        assert len(parcels) > 0

    def test_get_parcels_correct_project(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        parcels = LandRecordAdapter().get_parcels("PRJ-0002")
        assert all(p["project_id"] == "PRJ-0002" for p in parcels)

    def test_get_parcels_schema(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        parcels = LandRecordAdapter().get_parcels("PRJ-0001")
        expected_keys = {
            "parcel_id", "project_id", "survey_no", "area_ha",
            "land_type", "compensation_status", "possession_status",
            "doc_complete", "ownership_dispute",
        }
        for p in parcels:
            assert expected_keys == set(p.keys()), (
                f"Unexpected keys: {set(p.keys()) - expected_keys}"
            )

    def test_get_parcels_no_owner_name(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        parcels = LandRecordAdapter().get_parcels("PRJ-0001")
        for p in parcels:
            assert "owner" not in p
            assert "owner_name" not in p

    def test_get_parcels_unknown_project_returns_empty(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        assert LandRecordAdapter().get_parcels("PRJ-9999") == []

    def test_get_parcels_booleans(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        parcels = LandRecordAdapter().get_parcels("PRJ-0001")
        for p in parcels:
            assert isinstance(p["doc_complete"], bool)
            assert isinstance(p["ownership_dispute"], bool)

    def test_get_parcels_counts_sample_tiny(self):
        from backend.adapters.land_record_adapter import LandRecordAdapter

        adapter = LandRecordAdapter()
        # Known row counts from sample_tiny/parcels.csv
        assert len(adapter.get_parcels("PRJ-0001")) == 39
        assert len(adapter.get_parcels("PRJ-0002")) == 26
        assert len(adapter.get_parcels("PRJ-0003")) == 20
        assert len(adapter.get_parcels("PRJ-0004")) == 5
        assert len(adapter.get_parcels("PRJ-0005")) == 6


# ===========================================================================
# 3. CourtAdapter
# ===========================================================================


class TestCourtAdapter:
    def test_get_cases_returns_list(self):
        from backend.adapters.court_adapter import CourtAdapter
        from backend.adapters.land_record_adapter import LandRecordAdapter

        parcels = LandRecordAdapter().get_parcels("PRJ-0001")
        parcel_ids = [p["parcel_id"] for p in parcels]
        cases = CourtAdapter().get_cases(parcel_ids)
        assert isinstance(cases, list)
        assert len(cases) > 0

    def test_get_cases_empty_parcel_list(self):
        from backend.adapters.court_adapter import CourtAdapter

        assert CourtAdapter().get_cases([]) == []

    def test_get_cases_schema(self):
        from backend.adapters.court_adapter import CourtAdapter

        cases = CourtAdapter().get_cases(["PAR-PRJ-0001-001"])
        expected_keys = {"case_id", "parcel_id", "category", "filing_date", "status", "stay_order", "hearings"}
        for c in cases:
            assert expected_keys == set(c.keys())

    def test_get_cases_stay_order_is_bool(self):
        from backend.adapters.court_adapter import CourtAdapter

        cases = CourtAdapter().get_cases(["PAR-PRJ-0001-001", "PAR-PRJ-0001-004"])
        for c in cases:
            assert isinstance(c["stay_order"], bool), (
                f"stay_order should be bool, got {type(c['stay_order'])}: {c['stay_order']}"
            )

    def test_get_cases_filtered_by_parcel(self):
        from backend.adapters.court_adapter import CourtAdapter

        target = "PAR-PRJ-0002-001"
        cases = CourtAdapter().get_cases([target])
        assert all(c["parcel_id"] == target for c in cases)

    def test_get_cases_unknown_parcel_returns_empty(self):
        from backend.adapters.court_adapter import CourtAdapter

        assert CourtAdapter().get_cases(["PAR-NONEXISTENT-999"]) == []

    def test_get_cases_no_owner_name(self):
        from backend.adapters.court_adapter import CourtAdapter

        cases = CourtAdapter().get_cases(["PAR-PRJ-0001-001"])
        for c in cases:
            assert "owner" not in c
            assert "petitioner" not in c


# ===========================================================================
# 4. CompensationAdapter
# ===========================================================================


class TestCompensationAdapter:
    def test_get_compensation_returns_dict(self):
        from backend.adapters.compensation_adapter import CompensationAdapter

        result = CompensationAdapter().get_compensation("PRJ-0001")
        assert isinstance(result, dict)

    def test_get_compensation_schema(self):
        from backend.adapters.compensation_adapter import CompensationAdapter

        result = CompensationAdapter().get_compensation("PRJ-0001")
        assert set(result.keys()) == {"project_id", "award_amount", "disbursed_amount", "disputes"}

    def test_get_compensation_values_are_ints(self):
        from backend.adapters.compensation_adapter import CompensationAdapter

        result = CompensationAdapter().get_compensation("PRJ-0001")
        assert isinstance(result["award_amount"], int)
        assert isinstance(result["disbursed_amount"], int)
        assert isinstance(result["disputes"], int)

    def test_get_compensation_known_values(self):
        from backend.adapters.compensation_adapter import CompensationAdapter

        result = CompensationAdapter().get_compensation("PRJ-0001")
        assert result["award_amount"] == 216608106
        assert result["disbursed_amount"] == 123331288
        assert result["disputes"] == 3

    def test_get_compensation_unknown_project_returns_zeros(self):
        from backend.adapters.compensation_adapter import CompensationAdapter

        result = CompensationAdapter().get_compensation("PRJ-9999")
        assert result["award_amount"] == 0
        assert result["disbursed_amount"] == 0
        assert result["disputes"] == 0
        assert result["project_id"] == "PRJ-9999"

    def test_get_compensation_all_projects(self):
        from backend.adapters.compensation_adapter import CompensationAdapter

        adapter = CompensationAdapter()
        for pid in ["PRJ-0001", "PRJ-0002", "PRJ-0003", "PRJ-0004", "PRJ-0005"]:
            result = adapter.get_compensation(pid)
            assert result["project_id"] == pid
            assert result["award_amount"] > 0


# ===========================================================================
# 5. ApprovalsAdapter
# ===========================================================================


class TestApprovalsAdapter:
    def test_get_approvals_returns_list(self):
        from backend.adapters.approvals_adapter import ApprovalsAdapter

        result = ApprovalsAdapter().get_approvals("PRJ-0001")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_get_approvals_schema(self):
        from backend.adapters.approvals_adapter import ApprovalsAdapter

        result = ApprovalsAdapter().get_approvals("PRJ-0001")
        expected_keys = {"approval_id", "project_id", "name", "planned_date", "actual_date", "status"}
        for r in result:
            assert expected_keys == set(r.keys())

    def test_get_approvals_pending_has_null_actual_date(self):
        from backend.adapters.approvals_adapter import ApprovalsAdapter

        result = ApprovalsAdapter().get_approvals("PRJ-0001")
        pending = [r for r in result if r["status"] == "pending"]
        assert pending, "Expected pending approvals"
        for r in pending:
            assert r["actual_date"] is None

    def test_get_approvals_cleared_has_actual_date(self):
        from backend.adapters.approvals_adapter import ApprovalsAdapter

        result = ApprovalsAdapter().get_approvals("PRJ-0001")
        cleared = [r for r in result if r["status"] == "cleared"]
        assert cleared, "Expected cleared approvals"
        for r in cleared:
            assert r["actual_date"] is not None

    def test_get_approvals_unknown_project_returns_empty(self):
        from backend.adapters.approvals_adapter import ApprovalsAdapter

        assert ApprovalsAdapter().get_approvals("PRJ-9999") == []

    def test_get_approvals_correct_project(self):
        from backend.adapters.approvals_adapter import ApprovalsAdapter

        result = ApprovalsAdapter().get_approvals("PRJ-0003")
        assert all(r["project_id"] == "PRJ-0003" for r in result)


# ===========================================================================
# 6. IncidentsAdapter
# ===========================================================================


class TestIncidentsAdapter:
    def test_get_incidents_returns_list(self):
        from backend.adapters.incidents_adapter import IncidentsAdapter

        result = IncidentsAdapter().get_incidents("PRJ-0001")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_get_incidents_schema(self):
        from backend.adapters.incidents_adapter import IncidentsAdapter

        result = IncidentsAdapter().get_incidents("PRJ-0001")
        expected_keys = {"incident_id", "project_id", "type", "incident_date", "encroached_area_ha"}
        for r in result:
            assert expected_keys == set(r.keys())

    def test_get_incidents_area_is_float(self):
        from backend.adapters.incidents_adapter import IncidentsAdapter

        result = IncidentsAdapter().get_incidents("PRJ-0001")
        for r in result:
            assert isinstance(r["encroached_area_ha"], float), (
                f"Expected float, got {type(r['encroached_area_ha'])}: {r['encroached_area_ha']}"
            )

    def test_get_incidents_known_values(self):
        from backend.adapters.incidents_adapter import IncidentsAdapter

        result = IncidentsAdapter().get_incidents("PRJ-0001")
        # 3 incidents for PRJ-0001 in sample_tiny
        assert len(result) == 3
        types = {r["type"] for r in result}
        assert types == {"obstruction"}

    def test_get_incidents_unknown_project_returns_empty(self):
        from backend.adapters.incidents_adapter import IncidentsAdapter

        assert IncidentsAdapter().get_incidents("PRJ-9999") == []

    def test_get_incidents_correct_project(self):
        from backend.adapters.incidents_adapter import IncidentsAdapter

        result = IncidentsAdapter().get_incidents("PRJ-0002")
        assert all(r["project_id"] == "PRJ-0002" for r in result)


# ===========================================================================
# 7. fetch_external_bundle (integration)
# ===========================================================================


class TestFetchExternalBundle:
    def test_bundle_keys(self):
        from backend.adapters import fetch_external_bundle

        bundle = fetch_external_bundle("PRJ-0001")
        assert set(bundle.keys()) == {"parcels", "cases", "compensation", "approvals", "incidents"}

    def test_bundle_parcels_non_empty(self):
        from backend.adapters import fetch_external_bundle

        bundle = fetch_external_bundle("PRJ-0001")
        assert len(bundle["parcels"]) > 0

    def test_bundle_cases_non_empty(self):
        from backend.adapters import fetch_external_bundle

        bundle = fetch_external_bundle("PRJ-0001")
        assert len(bundle["cases"]) > 0

    def test_bundle_compensation_is_dict(self):
        from backend.adapters import fetch_external_bundle

        bundle = fetch_external_bundle("PRJ-0001")
        assert isinstance(bundle["compensation"], dict)

    def test_bundle_approvals_non_empty(self):
        from backend.adapters import fetch_external_bundle

        bundle = fetch_external_bundle("PRJ-0001")
        assert len(bundle["approvals"]) > 0

    def test_bundle_incidents_non_empty(self):
        from backend.adapters import fetch_external_bundle

        bundle = fetch_external_bundle("PRJ-0001")
        assert len(bundle["incidents"]) > 0

    def test_bundle_cases_belong_to_project_parcels(self):
        """Cases in the bundle must all belong to parcels of the requested project."""
        from backend.adapters import fetch_external_bundle

        bundle = fetch_external_bundle("PRJ-0002")
        parcel_ids = {p["parcel_id"] for p in bundle["parcels"]}
        for c in bundle["cases"]:
            assert c["parcel_id"] in parcel_ids, (
                f"Case {c['case_id']} has parcel_id {c['parcel_id']!r} "
                f"not in project parcel set {parcel_ids}"
            )

    def test_bundle_unknown_project_returns_empty_collections(self):
        from backend.adapters import fetch_external_bundle

        bundle = fetch_external_bundle("PRJ-9999")
        assert bundle["parcels"] == []
        assert bundle["cases"] == []
        assert bundle["approvals"] == []
        assert bundle["incidents"] == []
        assert bundle["compensation"]["award_amount"] == 0

    def test_bundle_all_projects(self):
        from backend.adapters import fetch_external_bundle

        for pid in ["PRJ-0001", "PRJ-0002", "PRJ-0003", "PRJ-0004", "PRJ-0005"]:
            bundle = fetch_external_bundle(pid)
            assert bundle["parcels"], f"No parcels for {pid}"
            assert bundle["compensation"]["project_id"] == pid
