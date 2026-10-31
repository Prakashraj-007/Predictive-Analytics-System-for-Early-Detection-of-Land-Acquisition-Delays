"""
Court cases adapter.

Today : reads ``cases.csv`` from DATA_DIR.
Later : replace _load() / get_cases() body with a live call to
        eCourts / NJDG (National Judicial Data Grid) REST API.
        Keep the return shape unchanged so callers are unaffected.

Real source : eCourts / NJDG  —  https://njdg.ecourts.gov.in/
"""

from __future__ import annotations

from .base import CsvAdapter

# Columns exposed to callers (no owner names)
_KEEP = ["case_id", "parcel_id", "category", "filing_date", "status", "stay_order", "hearings"]


class CourtAdapter(CsvAdapter):
    """Adapter for court / litigation data."""

    filename = "cases.csv"

    def get_cases(self, parcel_ids: list[str]) -> list[dict]:
        """Return all court cases that belong to the given parcel IDs.

        Parameters
        ----------
        parcel_ids:
            List of parcel identifiers (e.g. ``["PAR-PRJ-0001-001", ...]``).

        Returns
        -------
        list[dict]
            Each dict contains: case_id, parcel_id, category,
            filing_date, status, stay_order, hearings.
            Owner names are never included.
        """
        if not parcel_ids:
            return []

        parcel_set = set(parcel_ids)
        all_rows = self.rows()  # full CSV, coerced

        return [
            {k: row[k] for k in _KEEP if k in row}
            for row in all_rows
            if row.get("parcel_id") in parcel_set
        ]
