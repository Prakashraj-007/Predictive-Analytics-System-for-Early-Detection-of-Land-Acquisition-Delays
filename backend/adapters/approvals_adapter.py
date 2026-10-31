"""
Approvals / clearances adapter.

Today : reads ``approvals.csv`` from DATA_DIR.
Later : replace get_approvals() body with a live call to a
        PARIVESH-type multi-department clearance tracking system
        (MoEFCC's PARIVESH portal, or state-level clearance dashboards).
        Keep the return shape unchanged so callers are unaffected.

Real source : PARIVESH / state clearance tracking portal
              (e.g. https://parivesh.nic.in/)
"""

from __future__ import annotations

from .base import CsvAdapter

_KEEP = ["approval_id", "project_id", "name", "planned_date", "actual_date", "status"]


class ApprovalsAdapter(CsvAdapter):
    """Adapter for departmental approvals / clearances data."""

    filename = "approvals.csv"

    def get_approvals(self, project_id: str) -> list[dict]:
        """Return all approval/clearance records for ``project_id``.

        Parameters
        ----------
        project_id:
            The project identifier (e.g. ``"PRJ-0001"``).

        Returns
        -------
        list[dict]
            Each dict contains: approval_id, project_id, name,
            planned_date, actual_date (None if not yet cleared), status.
            Owner / personal names are never included.
        """
        rows = self.rows(filter={"project_id": project_id})
        return [{k: row.get(k) for k in _KEEP} for row in rows]
