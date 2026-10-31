"""
Database layer for LandSentinel.
Provides the Supabase Service Role client and data retrieval utilities.
Strictly adheres to docs/contracts.md.
"""
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

# Ensure environment variables are loaded
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

_supabase_client = None

def get_supabase_client():
    """
    Returns a cached instance of the Supabase Client using the Service Role Key.
    Bypasses RLS for administrative and backend API orchestration.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(supabase_url, service_role_key)
        return _supabase_client
    except Exception as e:
        print(f"[WARN] Failed to initialize Supabase client: {e}")
        return None
