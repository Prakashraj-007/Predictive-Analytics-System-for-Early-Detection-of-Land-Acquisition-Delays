"""
LandSentinel Demo Reset Utility (Task A11).
Wipes transient demo tables (tasks, alerts, predictions, audit_log),
reloads the demo dataset into Supabase, and re-computes batch predictions.
Ensures repetitive, repeatable demo and testing capability on clean machines.

Usage:
    python scripts/demo_reset.py
    python scripts/demo_reset.py --dir data/ongoing
"""
import os
import sys
import argparse
from pathlib import Path

# Add project root and backend to sys.path
repo_root = Path(__file__).resolve().parent.parent
backend_dir = repo_root / "backend"

for p in [str(repo_root), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from dotenv import load_dotenv

env_file = backend_dir / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()

from app.db import get_supabase_client
from app.seed_loader import load_dataset
from app.scripts.predict_all import predict_all_projects


def reset_transient_tables(supabase):
    """
    Deletes all existing rows from transient operational tables:
    tasks, alerts, predictions, audit_log.
    """
    print("\n--- Step 1: Wiping Transient Demo Tables ---")
    tables_to_wipe = ["tasks", "alerts", "predictions", "audit_log"]

    for table in tables_to_wipe:
        try:
            # Postgrest requires a filter to delete rows; neq("id", "00000000-...") or gte("created_at", '1970-01-01')
            if table == "tasks":
                res = supabase.table(table).delete().neq("task_id", "").execute()
            elif table == "alerts":
                res = supabase.table(table).delete().neq("alert_id", "").execute()
            elif table == "predictions":
                res = supabase.table(table).delete().neq("prediction_id", "").execute()
            elif table == "audit_log":
                res = supabase.table(table).delete().gte("timestamp", "1970-01-01T00:00:00Z").execute()
            print(f"  [OK] Cleaned table '{table}'.")
        except Exception as e:
            print(f"  [WARN] Failed to clean table '{table}': {e}")


def main():
    parser = argparse.ArgumentParser(description="LandSentinel Demo Reset Utility")
    parser.add_argument(
        "--dir",
        type=str,
        default="data/ongoing",
        help="Directory containing CSV files to reload (default: data/ongoing)"
    )
    args = parser.parse_args()

    print("=" * 70)
    print("LANDSENTINEL DEMO RESET UTILITY")
    print("=" * 70)

    supabase = get_supabase_client()
    if not supabase:
        print("[ERROR] Supabase client could not be initialized. Check backend/.env.")
        sys.exit(1)

    # 1. Wipe transient tables
    reset_transient_tables(supabase)

    # 2. Reload ongoing dataset
    data_path = repo_root / args.dir
    if not data_path.exists():
        fallback_path = repo_root / "data" / "sample_tiny"
        print(f"[INFO] '{data_path}' not found, falling back to '{fallback_path}'.")
        data_path = fallback_path

    print(f"\n--- Step 2: Reloading Dataset from '{data_path}' ---")
    success = load_dataset(data_path)
    if not success:
        print("[ERROR] Dataset reload failed.")
        sys.exit(1)

    # 3. Re-run batch predictions
    print("\n--- Step 3: Recomputing Predictions for Demo Projects ---")
    predict_all_projects()

    print("\n" + "=" * 70)
    print("Demo environment successfully reset and ready for presentation!")
    print("=" * 70)


if __name__ == "__main__":
    main()
