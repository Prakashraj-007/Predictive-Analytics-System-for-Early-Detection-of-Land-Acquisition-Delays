from __future__ import annotations

import pandas as pd

PROJECT_TYPE_ORDER = ["highway", "rail", "irrigation", "power", "urban"]
CURRENT_STAGE_ORDER = ["planning", "sia", "notification", "award", "compensation", "possession", "rr"]
FEATURE_COLUMNS = [
    "land_area_ha",
    "families_affected",
    "project_type",
    "litigation_cases",
    "stay_orders",
    "ownership_disputes",
    "compensation_pending_pct",
    "approval_days_pending",
    "docs_incomplete_pct",
    "officer_response_days",
    "encroached_area_pct",
    "possession_pct",
    "rr_progress_pct",
    "current_stage",
    "district_past_delay_rate",
]


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Map categorical fields to fixed category codes and return model-ready columns."""
    prepared = df.copy()
    if "project_type" in prepared.columns:
        prepared["project_type"] = pd.Categorical(
            prepared["project_type"], categories=PROJECT_TYPE_ORDER, ordered=True
        ).codes
    if "current_stage" in prepared.columns:
        prepared["current_stage"] = pd.Categorical(
            prepared["current_stage"], categories=CURRENT_STAGE_ORDER, ordered=True
        ).codes
    return prepared
