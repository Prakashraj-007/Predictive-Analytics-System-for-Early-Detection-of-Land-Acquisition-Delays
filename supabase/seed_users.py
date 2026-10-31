#!/usr/bin/env python3
"""
Seed Users Script for LandSentinel
Uses the Supabase Admin API to create the 5 demo users and inserts their profile records.
All users have password: demo123

Users created:
- pm1: project_manager, district Pune
- collector1: collector, district Pune
- policymaker1: policymaker
- admin1: admin
- auditor1: auditor
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Search for .env file in backend/ or root
env_paths = [
    Path(__file__).resolve().parent.parent / "backend" / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path.cwd() / "backend" / ".env",
    Path.cwd() / ".env",
]
for p in env_paths:
    if p.exists():
        load_dotenv(dotenv_path=p)
        print(f"Loaded environment variables from {p}")
        break

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: 'supabase' package is not installed.")
    print("Install dependencies with: pip install supabase python-dotenv")
    sys.exit(1)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("=" * 60)
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
    print("Please set these variables in backend/.env or your environment.")
    print("Example in backend/.env:")
    print("  SUPABASE_URL=https://xyzcompany.supabase.co")
    print("  SUPABASE_SERVICE_ROLE_KEY=eyJh...")
    print("=" * 60)
    sys.exit(1)

DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "demo123")
EMAIL_DOMAIN = os.environ.get("DEMO_EMAIL_DOMAIN", "landsentinel.gov.in")

DEMO_USERS = [
    {
        "username": "pm1",
        "email": f"pm1@{EMAIL_DOMAIN}",
        "full_name": "Priya Sharma (PM)",
        "role": "project_manager",
        "district": "Pune",
    },
    {
        "username": "collector1",
        "email": f"collector1@{EMAIL_DOMAIN}",
        "full_name": "Rajesh Patil (District Collector)",
        "role": "collector",
        "district": "Pune",
    },
    {
        "username": "policymaker1",
        "email": f"policymaker1@{EMAIL_DOMAIN}",
        "full_name": "Dr. Sunita Deshmukh (Secretary)",
        "role": "policymaker",
        "district": None,
    },
    {
        "username": "admin1",
        "email": f"admin1@{EMAIL_DOMAIN}",
        "full_name": "Anand Verma (System Admin)",
        "role": "admin",
        "district": None,
    },
    {
        "username": "auditor1",
        "email": f"auditor1@{EMAIL_DOMAIN}",
        "full_name": "Kavita Rao (State Auditor)",
        "role": "auditor",
        "district": None,
    },
]

def seed_users():
    print(f"Connecting to Supabase at: {SUPABASE_URL}")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    print("\nFetching existing users from Supabase Auth...")
    existing_users_map = {}
    try:
        users_resp = supabase.auth.admin.list_users()
        # list_users may return a list or object with users attribute depending on SDK version
        users_list = getattr(users_resp, "users", users_resp)
        if isinstance(users_list, list):
            for u in users_list:
                email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
                uid = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
                if email and uid:
                    existing_users_map[email.lower()] = str(uid)
    except Exception as e:
        print(f"Note: Could not list users directly: {e}. Will attempt direct user creation/lookup.")

    print("\n" + "=" * 65)
    print("Seeding Demo Users and Profiles...")
    print("=" * 65)

    created_summary = []

    for user_info in DEMO_USERS:
        email = user_info["email"].lower()
        role = user_info["role"]
        full_name = user_info["full_name"]
        district = user_info["district"]
        user_id = existing_users_map.get(email)

        if not user_id:
            try:
                # Create user via Supabase Auth Admin API
                create_resp = supabase.auth.admin.create_user({
                    "email": email,
                    "password": DEMO_PASSWORD,
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": full_name,
                        "role": role,
                        "district": district
                    }
                })
                new_user = getattr(create_resp, "user", create_resp)
                user_id = str(getattr(new_user, "id", None) or (new_user.get("id") if isinstance(new_user, dict) else None))
                print(f"[CREATED AUTH USER] {email} (ID: {user_id})")
            except Exception as e:
                err_msg = str(e).lower()
                if "already" in err_msg or "exists" in err_msg:
                    print(f"[EXISTS] Auth user {email} already exists, attempting to find ID...")
                    # Fallback lookup in profiles
                    try:
                        p_res = supabase.table("profiles").select("user_id").eq("role", role).execute()
                        if p_res.data and len(p_res.data) > 0:
                            user_id = p_res.data[0]["user_id"]
                    except Exception:
                        pass
                else:
                    print(f"[ERROR] Failed to create user {email}: {e}")
                    continue

        if user_id:
            # Upsert into public.profiles
            profile_data = {
                "user_id": user_id,
                "full_name": full_name,
                "role": role,
                "district": district
            }
            try:
                supabase.table("profiles").upsert(profile_data).execute()
                print(f"[SYNCED PROFILE] {full_name} | Role: {role} | District: {district or 'N/A'}")
                created_summary.append({
                    "email": email,
                    "password": DEMO_PASSWORD,
                    "role": role,
                    "district": district or "None",
                    "user_id": user_id
                })
            except Exception as e:
                print(f"[ERROR] Failed to upsert profile for {email}: {e}")
        else:
            print(f"[WARN] Skipping profile upsert for {email} because user ID was not retrieved.")

    print("\n" + "=" * 65)
    print("Seed Complete! Summary of Demo Accounts:")
    print("=" * 65)
    print(f"{'Email':<32} {'Password':<10} {'Role':<16} {'District'}")
    print("-" * 65)
    for u in created_summary:
        print(f"{u['email']:<32} {u['password']:<10} {u['role']:<16} {u['district']}")
    print("=" * 65)

if __name__ == "__main__":
    seed_users()
