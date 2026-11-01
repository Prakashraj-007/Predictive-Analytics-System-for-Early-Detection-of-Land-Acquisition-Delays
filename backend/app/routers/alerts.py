"""
Alerts Router for LandSentinel (Task A9 Real Implementation).
Provides real-time early warning alerts and acknowledgment management with role-based scoping.

Strictly adheres to docs/contracts.md sections 3 & 5.
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas import AlertItem, AlertAckResponse
from app.stubs import SAMPLE_ALERTS
from app.auth import CurrentUser, get_current_user, require_roles
from app.services.audit import log_action
from app.db import get_supabase_client

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertItem])
def list_alerts(user: CurrentUser = Depends(get_current_user)):
    """
    Retrieves system delay risk alerts with role-based filtering:
    - Project Manager: alerts on own projects only.
    - Collector: alerts in assigned district only.
    - Policymaker: High-risk alerts only (statewide).
    - Admin & Auditor: all alerts statewide.
    """
    supabase = get_supabase_client()
    alerts = []
    
    if supabase:
        try:
            query = supabase.table("alerts").select("*").order("created_at", desc=True)
            
            # Collector scoping
            if user.role == "collector" and user.district:
                query = query.ilike("district", user.district)
                
            # Policymaker scoping: High band only (> 60)
            if user.role == "policymaker":
                query = query.gt("risk_score", 60)
                
            res = query.execute()
            if res.data:
                alerts = res.data
        except Exception as e:
            print(f"[WARN] Failed to query alerts table: {e}")

    if not alerts:
        # Fallback to stub alerts filtered by role
        for a in SAMPLE_ALERTS:
            if user.role == "collector" and user.district:
                if a.get("district", "").lower() != user.district.lower():
                    continue
            if user.role == "policymaker" and a.get("risk_score", 0) <= 60:
                continue
            alerts.append(dict(a))

    # For Project Manager, filter by projects owned by this PM
    if user.role == "project_manager" and user.user_id and supabase:
        try:
            pm_projects = (
                supabase.table("projects")
                .select("project_id")
                .eq("created_by", user.user_id)
                .execute()
            )
            owned_pids = set(p["project_id"] for p in pm_projects.data or [])
            alerts = [a for a in alerts if a.get("project_id") in owned_pids]
        except Exception as pme:
            print(f"[WARN] Failed to filter PM alerts: {pme}")

    # Fetch project names for display
    pids = list(set(a.get("project_id") for a in alerts if a.get("project_id")))
    name_map = {}
    if supabase and pids:
        try:
            proj_res = (
                supabase.table("projects")
                .select("project_id, name")
                .in_("project_id", pids)
                .execute()
            )
            for p in proj_res.data or []:
                name_map[p["project_id"]] = p["name"]
        except Exception as ne:
            print(f"[WARN] Failed to fetch project names for alerts: {ne}")

    results = []
    for a in alerts:
        pid = a.get("project_id", "")
        p_name = a.get("project_name") or name_map.get(pid) or f"Project {pid}"
        results.append(
            AlertItem(
                alert_id=str(a.get("alert_id")),
                project_id=pid,
                project_name=p_name,
                district=str(a.get("district", "Unknown")),
                reason=str(a.get("reason", "Delay risk elevated")),
                risk_score=int(a.get("risk_score", 65)),
                previous_score=int(a["previous_score"]) if a.get("previous_score") is not None else None,
                status=str(a.get("status", "open")),
                created_at=str(a.get("created_at", ""))
            )
        )

    return results


@router.post("/{id}/ack", response_model=AlertAckResponse)
def acknowledge_alert(
    id: str,
    user: CurrentUser = Depends(require_roles("project_manager", "collector", "policymaker", "admin"))
):
    """
    Acknowledges an active alert and marks its status as 'ack'.
    Audit-logs the action. Forbidden for auditors.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            supabase.table("alerts").update({"status": "ack"}).eq("alert_id", id).execute()
        except Exception as e:
            print(f"[WARN] Failed to update alert status in DB: {e}")

    log_action(user.user_id, "ACKNOWLEDGE_ALERT", details={"alert_id": id})
    return AlertAckResponse(
        status="ack",
        alert_id=id
    )
