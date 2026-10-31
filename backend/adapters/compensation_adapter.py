"""
Compensation adapter.

Today : reads ``compensation.csv`` from DATA_DIR.
Later : replace get_compensation() body with a live call to the
        state/central compensation & payment-disbursement system
        (e.g. PFMS — Public Financial Management System, or the
        state R&R department's payment portal).
        Keep the return shape unchanged so callers are unaffected.

Real source : PFMS / state R&R payment portal
              (e.g. https://pfms.nic.in/)
"""

from __future__ import annotations

from .base import CsvAdapter

_ZERO_ROW = {
    "project_id": None,
    "award_amount": 0,
    "disbursed_amount": 0,
    "disputes": 0,
}


class CompensationAdapter(CsvAdapter):
    """Adapter for compensation / disbursement summary data."""

    filename = "compensation.csv"

    def get_compensation(self, project_id: str) -> dict:
        """Return the compensation summary for ``project_id``.

        If the project has no compensation record, returns a zero-valued
        dict so callers never have to guard for ``None``.

        Parameters
        ----------
        project_id:
            The project identifier (e.g. ``"PRJ-0001"``).

        Returns
        -------
        dict
            Keys: project_id, award_amount (int), disbursed_amount (int),
            disputes (int).
            Owner / personal names are never included.
        """
        rows = self.rows(filter={"project_id": project_id})
        if not rows:
            return {**_ZERO_ROW, "project_id": project_id}

        row = rows[0]
        return {
            "project_id": row.get("project_id"),
            "award_amount": _to_int(row.get("award_amount")),
            "disbursed_amount": _to_int(row.get("disbursed_amount")),
            "disputes": _to_int(row.get("disputes")),
        }


def _to_int(val) -> int:
    """Safely cast a value to int, returning 0 on failure."""
    try:
        return int(float(val)) if val is not None else 0
    except (ValueError, TypeError):
        return 0
