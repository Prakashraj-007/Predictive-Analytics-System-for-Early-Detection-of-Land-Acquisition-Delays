"""
Audit Service for LandSentinel.
Logs user and system actions into audit_log.
Strictly adheres to docs/contracts.md section 2 & 3.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.db import get_supabase_client
from app.stubs import SAMPLE_AUDIT

def log_action(
    user_id: str,
    action: str,
    project_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    model_version: Optional[str] = None
) -> Dict[str, Any]:
    """
    Inserts a record into the audit_log table and updates in-memory stub history.
    """
    log_id = f"LOG-{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()

    entry = {
        "log_id": log_id,
        "user_id": user_id,
        "user": user_id,  # for compatibility with contract GET /audit shape
        "action": action,
        "project_id": project_id,
        "timestamp": timestamp,
        "model_version": model_version,
        "details": details or {}
    }

    # Always record into in-memory stub records
    SAMPLE_AUDIT.insert(0, entry)

    # Attempt to persist to Supabase audit_log table
    supabase = get_supabase_client()
    if supabase:
        try:
            db_payload = {
                "log_id": log_id,
                "user_id": user_id,
                "action": action,
                "project_id": project_id,
                "timestamp": timestamp,
                "details": details or {}
            }
            supabase.table("audit_log").insert(db_payload).execute()
        except Exception as e:
            # Audit logging failure should not break request processing
            print(f"[WARN] Failed to write to Supabase audit_log table: {e}")

    return entry

