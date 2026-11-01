"""
Batch Prediction Script (Task A8).
Runs run_prediction for every active project in the Supabase database
to populate predictions and alerts tables for demo and dashboard analytics.

Usage:
    python -m app.scripts.predict_all
    or
    python backend/app/scripts/predict_all.py
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Load .env
env_file = backend_dir / ".env"
if env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv()

from app.db import get_supabase_client
from app.services.prediction_service import run_prediction
from app.stubs import SAMPLE_PROJECTS


def predict_all_projects():
    print("=" * 70)
    print("LandSentinel Batch Prediction Pipeline (Task A8)")
    print("=" * 70)
    
    supabase = get_supabase_client()
    project_list = []
    
    if supabase:
        try:
            res = supabase.table("projects").select("project_id, name, district, status").execute()
            if res.data:
                project_list = res.data
                print(f"[INFO] Fetched {len(project_list)} projects from Supabase 'projects' table.")
        except Exception as e:
            print(f"[WARN] Failed to fetch projects from Supabase: {e}")

    if not project_list:
        print("[INFO] Fallback to in-memory sample projects.")
        project_list = [
            {"project_id": p["project_id"], "name": p["name"], "district": p.get("district", "Thane")}
            for p in SAMPLE_PROJECTS
        ]

    counts = {"High": 0, "Medium": 0, "Low": 0}
    total = len(project_list)
    success = 0

    print(f"\nProcessing predictions for {total} projects...")
    for idx, p in enumerate(project_list, 1):
        pid = p["project_id"]
        name = p.get("name", pid)
        try:
            pred = run_prediction(project_id=pid, user_id="system_init")
            band = pred.get("band", "Medium")
            score = pred.get("risk_score", 0)
            counts[band] = counts.get(band, 0) + 1
            success += 1
            print(f"  [{idx:02d}/{total:02d}] {pid} - {name[:30]:<30} | Score: {score:>2} ({band:<6})")
        except Exception as ex:
            print(f"  [{idx:02d}/{total:02d}] {pid} - ERROR: {ex}")

    print("\n" + "=" * 70)
    print(f"Summary: Successfully predicted {success}/{total} projects.")
    print(f"Distribution: High: {counts.get('High', 0)} | Medium: {counts.get('Medium', 0)} | Low: {counts.get('Low', 0)}")
    print("=" * 70)


if __name__ == "__main__":
    predict_all_projects()
