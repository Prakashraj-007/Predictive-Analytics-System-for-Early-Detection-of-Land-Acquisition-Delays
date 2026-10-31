"""
Seed Loader CLI for LandSentinel.
Loads ongoing and sample CSV datasets into Supabase Postgres in dependency order.
Strictly adheres to docs/contracts.md section 2 & A6 specification.

Usage:
    python -m app.seed_loader --dir data/ongoing
    python -m app.seed_loader --dir data/sample_tiny
"""
import os
import sys
from pathlib import Path

# Add backend directory to path if needed
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import argparse
import time
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np

from app.db import get_supabase_client

# Required columns definition strictly adhering to contracts.md section 2
TABLE_CONFIG = [
    {
        "table": "projects",
        "file": "projects.csv",
        "pk": "project_id",
        "required_columns": [
            "project_id", "name", "type", "agency", "state", "district",
            "lat", "lon", "land_area_ha", "families_affected",
            "families_resettlement", "budget", "planned_start", "planned_end",
            "current_stage", "status", "rr_progress_pct", "officer_response_days"
        ],
        "booleans": [],
        "integers": ["families_affected", "families_resettlement", "officer_response_days"],
        "floats": ["lat", "lon", "land_area_ha", "budget", "rr_progress_pct"]
    },
    {
        "table": "parcels",
        "file": "parcels.csv",
        "pk": "parcel_id",
        "required_columns": [
            "parcel_id", "project_id", "survey_no", "area_ha",
            "land_type", "compensation_status", "possession_status",
            "doc_complete", "ownership_dispute"
        ],
        "booleans": ["doc_complete", "ownership_dispute"],
        "integers": [],
        "floats": ["area_ha"]
    },
    {
        "table": "cases",
        "file": "cases.csv",
        "pk": "case_id",
        "required_columns": [
            "case_id", "parcel_id", "category", "filing_date",
            "status", "stay_order", "hearings"
        ],
        "booleans": ["stay_order"],
        "integers": ["hearings"],
        "floats": []
    },
    {
        "table": "approvals",
        "file": "approvals.csv",
        "pk": "approval_id",
        "required_columns": [
            "approval_id", "project_id", "name", "planned_date", "status"
        ],
        "booleans": [],
        "integers": [],
        "floats": []
    },
    {
        "table": "compensation",
        "file": "compensation.csv",
        "pk": "project_id",
        "required_columns": [
            "project_id", "award_amount", "disbursed_amount", "disputes"
        ],
        "booleans": [],
        "integers": ["disputes"],
        "floats": ["award_amount", "disbursed_amount"]
    },
    {
        "table": "incidents",
        "file": "incidents.csv",
        "pk": "incident_id",
        "required_columns": [
            "incident_id", "project_id", "type", "incident_date", "encroached_area_ha"
        ],
        "booleans": [],
        "integers": [],
        "floats": ["encroached_area_ha"]
    }
]

DEFAULT_PM_USER_ID = "5ad5e3f4-99ff-445b-bd5c-2fee103c357e"


def clean_records(df: pd.DataFrame, cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Cleans a DataFrame, casting types and converting NaNs to None for Postgres.
    """
    records = []
    for _, row in df.iterrows():
        rec = {}
        for col in df.columns:
            val = row[col]

            # Convert pd.NA / np.nan to None
            if pd.isna(val) or val is None:
                val = None
            else:
                if col in cfg.get("booleans", []):
                    if isinstance(val, (bool, np.bool_)):
                        val = bool(val)
                    elif str(val).strip().lower() in ("true", "1", "t", "yes"):
                        val = True
                    elif str(val).strip().lower() in ("false", "0", "f", "no"):
                        val = False
                    else:
                        val = bool(val)
                elif col in cfg.get("integers", []):
                    try:
                        val = int(val)
                    except (ValueError, TypeError):
                        val = None
                elif col in cfg.get("floats", []):
                    try:
                        val = float(val)
                    except (ValueError, TypeError):
                        val = None
                elif isinstance(val, (np.floating, float)):
                    val = float(val)
                elif isinstance(val, (np.integer, int)):
                    val = int(val)
                else:
                    val = str(val).strip()

            rec[col] = val

        # Handle project created_by: if null, assign demo PM user_id
        if cfg["table"] == "projects":
            if not rec.get("created_by"):
                rec["created_by"] = DEFAULT_PM_USER_ID

        records.append(rec)
    return records


def load_dataset(data_dir: Path, batch_size: int = 500) -> bool:
    """
    Reads CSVs from data_dir and upserts them into Supabase in dependency order.
    """
    if not data_dir.exists():
        print(f"Error: Directory '{data_dir}' does not exist.")
        return False

    supabase = get_supabase_client()
    if not supabase:
        print("Error: Could not connect to Supabase. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.")
        return False

    print("=" * 65)
    print(f"LandSentinel Seed Loader")
    print(f"Source Directory : {data_dir.resolve()}")
    print(f"Batch Size       : {batch_size}")
    print("=" * 65)

    start_time = time.time()
    total_loaded = 0

    # Cache valid IDs for FK integrity filtering if needed
    known_project_ids = set()
    known_parcel_ids = set()

    for cfg in TABLE_CONFIG:
        table_name = cfg["table"]
        filename = cfg["file"]
        pk = cfg["pk"]
        file_path = data_dir / filename

        if not file_path.exists():
            print(f"[MISSING] File '{filename}' not found in {data_dir}. Skipping {table_name}.")
            continue

        try:
            df = pd.read_csv(file_path)
        except Exception as e:
            print(f"[ERROR] Could not parse CSV '{filename}': {e}")
            return False

        # Validate required columns
        missing_cols = [c for c in cfg["required_columns"] if c not in df.columns]
        if missing_cols:
            print(f"\n[SCHEMA MISMATCH ERROR] Table '{table_name}' is missing required columns in '{filename}':")
            for mc in missing_cols:
                print(f"  - {mc}")
            sys.exit(1)

        # FK Safeguards
        if table_name == "parcels" and known_project_ids:
            df = df[df["project_id"].isin(known_project_ids)]
        elif table_name == "cases" and known_parcel_ids:
            df = df[df["parcel_id"].isin(known_parcel_ids)]
        elif table_name in ("approvals", "compensation", "incidents") and known_project_ids:
            df = df[df["project_id"].isin(known_project_ids)]

        records = clean_records(df, cfg)
        num_records = len(records)

        if table_name == "projects":
            known_project_ids = {r["project_id"] for r in records if r.get("project_id")}
        elif table_name == "parcels":
            known_parcel_ids = {r["parcel_id"] for r in records if r.get("parcel_id")}

        print(f"\nLoading [{table_name:<12}] from {filename} ({num_records} rows)...")

        # Upsert in batches of batch_size
        table_upserted = 0
        for i in range(0, num_records, batch_size):
            batch = records[i : i + batch_size]
            try:
                res = supabase.table(table_name).upsert(batch, on_conflict=pk).execute()
                table_upserted += len(batch)
                print(f"  Upserted rows {i + 1} to {min(i + batch_size, num_records)} / {num_records}")
            except Exception as e:
                print(f"[ERROR] Failed upserting into table '{table_name}': {e}")
                return False

        print(f"--> [{table_name}] Successfully upserted {table_upserted} rows.")
        total_loaded += table_upserted

    elapsed = round(time.time() - start_time, 2)
    print("\n" + "=" * 65)
    print(f"Seed complete! Total {total_loaded} records upserted across all tables in {elapsed}s.")
    print("=" * 65)
    return True


def main():
    parser = argparse.ArgumentParser(description="LandSentinel Supabase Seed Loader")
    parser.add_argument(
        "--dir",
        type=str,
        default="data/ongoing",
        help="Directory containing the ongoing CSV files (e.g. data/ongoing or data/sample_tiny)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Batch size for bulk upsert operations (default: 500)"
    )
    args = parser.parse_args()

    target_dir = Path(args.dir)
    success = load_dataset(target_dir, batch_size=args.batch_size)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
