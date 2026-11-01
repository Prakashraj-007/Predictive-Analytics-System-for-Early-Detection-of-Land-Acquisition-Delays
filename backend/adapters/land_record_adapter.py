"""
Land-record (parcel) adapter.

Today : reads ``parcels.csv`` from DATA_DIR.
Later : replace get_parcels() body with a live call to a
        Bhulekh-type state land-records portal (e.g. MahaBhulekh for
        Maharashtra, or the NIC-hosted state land-records API).
        Keep the return shape unchanged so callers are unaffected.

Real source : Bhulekh-type land-records portals
              (e.g. https://mahabhulekh.maharashtra.gov.in/)
"""

from __future__ import annotations

from .base import CsvAdapter

# Columns exposed to callers — owner name is intentionally excluded
_KEEP = [
    "parcel_id",
    "project_id",
    "survey_no",
    "area_ha",
    "land_type",
    "compensation_status",
    "possession_status",
    "doc_complete",
    "ownership_dispute",
]


class LandRecordAdapter(CsvAdapter):
    """Adapter for land-record / parcel data."""

    filename = "parcels.csv"

    def get_parcels(self, project_id: str) -> list[dict]:
        """Return all parcels belonging to ``project_id``.

        Parameters
        ----------
        project_id:
            The project identifier (e.g. ``"PRJ-0001"``).

        Returns
        -------
        list[dict]
            Each dict contains: parcel_id, project_id, survey_no,
            area_ha, land_type, compensation_status, possession_status,
            doc_complete (bool), ownership_dispute (bool).
            Owner / personal names are never included.
        """
        all_rows = self.rows(filter={"project_id": project_id})
        return [{k: row[k] for k in _KEEP if k in row} for row in all_rows]
