"""
Incidents adapter.

Today : reads ``incidents.csv`` from DATA_DIR.
Later : replace get_incidents() body with a live call to the
        police / district-administration incident-reporting system
        (state police district portals or the MHA crime-statistics API).
        Keep the return shape unchanged so callers are unaffected.

Real source : Police / district administration records
              (state police portals, MHA NCRB data feeds)
"""

from __future__ import annotations

from .base import CsvAdapter

_KEEP = ["incident_id", "project_id", "type", "incident_date", "encroached_area_ha"]


class IncidentsAdapter(CsvAdapter):
    """Adapter for field incident data (obstruction, encroachment, etc.)."""

    filename = "incidents.csv"

    def get_incidents(self, project_id: str) -> list[dict]:
        """Return all incidents for ``project_id``.

        Parameters
        ----------
        project_id:
            The project identifier (e.g. ``"PRJ-0001"``).

        Returns
        -------
        list[dict]
            Each dict contains: incident_id, project_id, type,
            incident_date, encroached_area_ha (float or None).
            Owner / personal names are never included.
        """
        rows = self.rows(filter={"project_id": project_id})
        result = []
        for row in rows:
            rec = {k: row.get(k) for k in _KEEP}
            # Coerce encroached_area_ha to float
            raw = rec.get("encroached_area_ha")
            rec["encroached_area_ha"] = _to_float(raw)
            result.append(rec)
        return result


def _to_float(val) -> float | None:
    """Safely cast a value to float, returning None on failure."""
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None
