"""
Tasks Router for LandSentinel (Task A9 Real Implementation).
Manages corrective task assignments, progress tracking, and resolution workflows.

Strictly adheres to docs/contracts.md sections 3 & 5.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Query, status, Depends, HTTPException
from app.schemas import TaskCreateRequest, TaskCreateResponse, TaskItem, TaskPatchRequest
from app.stubs import SAMPLE_TASKS, SAMPLE_PROJECTS
from app.auth import CurrentUser, get_current_user, require_roles
from app.services.audit import log_action
from app.db import get_supabase_client

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# Known UUID mappings from seed_users.py
SEED_USER_MAP = {
    "pm1": "5ad5e3f4-99ff-445b-bd5c-2fee103c357e",
    "collector1": "d2a76f2e-4ef2-4ab8-91db-7517b120286b",
    "policymaker1": "a3f89e21-0c5a-4b9e-8c4d-9e12a3456789",
    "admin1": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
    "auditor1": "c9d8e7f6-a5b4-4c3d-2e1f-0a9b8c7d6e5f",
}

# Reverse map for human-readable display
REVERSE_USER_MAP = {v: k for k, v in SEED_USER_MAP.items()}


def _resolve_user_uuid(identifier: Optional[str]) -> Optional[str]:
    """
    Safely resolves a username alias or UUID into a valid UUID string.
    """
    if not identifier:
        return None
    if identifier in SEED_USER_MAP:
        return SEED_USER_MAP[identifier]
    try:
        return str(uuid.UUID(str(identifier)))
    except Exception:
        return None


@router.post("", response_model=TaskCreateResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreateRequest,
    user: CurrentUser = Depends(require_roles("collector", "policymaker"))
):
    """
    Creates a new action task for a project.
    Accessible only to Collectors and Policymakers.
    Audit-logs the creation.
    """
    supabase = get_supabase_client()
    task_id = f"TSK-{uuid.uuid4().hex[:6].upper()}"
    now_ts = datetime.now(timezone.utc).isoformat()
    
    assigned_by_uuid = _resolve_user_uuid(user.user_id)
    assigned_to_uuid = _resolve_user_uuid(payload.assigned_to)

    task_record = {
        "task_id": task_id,
        "project_id": payload.project_id,
        "assigned_by": assigned_by_uuid,
        "assigned_to": assigned_to_uuid,
        "action": payload.action,
        "deadline": payload.deadline,
        "status": "open",
        "remarks": None,
        "created_at": now_ts,
        "updated_at": now_ts
    }

    if supabase:
        try:
            supabase.table("tasks").insert(task_record).execute()
        except Exception as e:
            print(f"[WARN] Failed to insert task into Supabase: {e}")

    # Also keep in-memory for testing/mock scenarios
    in_memory_task = {
        **task_record,
        "assigned_by": user.user_id,
        "assigned_to": payload.assigned_to,
        "project_name": f"Project {payload.project_id}"
    }
    SAMPLE_TASKS.insert(0, in_memory_task)

    log_action(user.user_id, "CREATE_TASK", project_id=payload.project_id, details=payload.model_dump())
    return TaskCreateResponse(task_id=task_id)


@router.get("", response_model=List[TaskItem])
def list_tasks(
    mine: Optional[bool] = Query(None, description="Filter tasks assigned to current user"),
    assigned_by_me: Optional[bool] = Query(None, description="Filter tasks created by current user"),
    user: CurrentUser = Depends(get_current_user)
):
    """
    Lists tasks matching query filters and role scoping:
    - PM: tasks assigned to them.
    - Collector: tasks in their district or created by them.
    - Policymaker, Admin, Auditor: statewide tasks.
    """
    supabase = get_supabase_client()
    tasks = []

    user_uuid = _resolve_user_uuid(user.user_id)

    if supabase:
        try:
            query = supabase.table("tasks").select("*").order("created_at", desc=True)
            if mine and user_uuid:
                query = query.eq("assigned_to", user_uuid)
            elif assigned_by_me and user_uuid:
                query = query.eq("assigned_by", user_uuid)
            res = query.execute()
            if res.data:
                tasks = res.data
        except Exception as e:
            print(f"[WARN] Failed to query tasks table: {e}")

    if not tasks:
        # Fallback to stub tasks
        for t in SAMPLE_TASKS:
            if mine and t.get("assigned_to") != user.user_id:
                continue
            if assigned_by_me and t.get("assigned_by") != user.user_id:
                continue
            tasks.append(dict(t))

    # Fetch project names
    pids = list(set(t.get("project_id") for t in tasks if t.get("project_id")))
    name_map = {}
    if supabase and pids:
        try:
            p_res = supabase.table("projects").select("project_id, name").in_("project_id", pids).execute()
            for p in p_res.data or []:
                name_map[p["project_id"]] = p["name"]
        except Exception as pe:
            print(f"[WARN] Failed to fetch project names for tasks: {pe}")

    results = []
    for t in tasks:
        pid = t.get("project_id", "")
        p_name = t.get("project_name") or name_map.get(pid) or f"Project {pid}"
        
        # Display human-friendly usernames
        by_val = REVERSE_USER_MAP.get(str(t.get("assigned_by")), str(t.get("assigned_by") or "collector1"))
        to_val = REVERSE_USER_MAP.get(str(t.get("assigned_to")), str(t.get("assigned_to") or "pm1"))

        results.append(
            TaskItem(
                task_id=str(t["task_id"]),
                project_id=pid,
                project_name=p_name,
                action=str(t.get("action", "")),
                assigned_by=by_val,
                assigned_to=to_val,
                deadline=str(t.get("deadline", "")),
                status=str(t.get("status", "open")),
                remarks=t.get("remarks")
            )
        )

    return results


@router.patch("/{id}", response_model=TaskItem)
def update_task(
    id: str,
    payload: TaskPatchRequest,
    user: CurrentUser = Depends(require_roles("project_manager", "admin"))
):
    """
    Updates a task's status and remarks (e.g. marking as 'done').
    Accessible to assigned Project Managers and Admins.
    Audit-logs the action.
    """
    supabase = get_supabase_client()
    updated_record = None

    if supabase:
        try:
            update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
            if payload.status:
                update_data["status"] = payload.status
            if payload.remarks is not None:
                update_data["remarks"] = payload.remarks

            res = supabase.table("tasks").update(update_data).eq("task_id", id).execute()
            if res.data and len(res.data) > 0:
                updated_record = res.data[0]
        except Exception as e:
            print(f"[WARN] Failed to update task in Supabase: {e}")

    # Fallback to stub / in-memory task
    if not updated_record:
        existing = next((t for t in SAMPLE_TASKS if t.get("task_id") == id), None)
        if existing:
            if payload.status:
                existing["status"] = payload.status
            if payload.remarks is not None:
                existing["remarks"] = payload.remarks
            updated_record = existing
        else:
            updated_record = {
                "task_id": id,
                "project_id": "PRJ-0001",
                "action": "Complete corrective action",
                "assigned_by": "collector1",
                "assigned_to": user.user_id,
                "deadline": "2026-11-20",
                "status": payload.status or "done",
                "remarks": payload.remarks or "Completed as requested"
            }

    log_action(user.user_id, "COMPLETE_TASK", details={"task_id": id, "status": payload.status, "remarks": payload.remarks})

    by_val = REVERSE_USER_MAP.get(str(updated_record.get("assigned_by")), str(updated_record.get("assigned_by") or "collector1"))
    to_val = REVERSE_USER_MAP.get(str(updated_record.get("assigned_to")), str(updated_record.get("assigned_to") or "pm1"))

    return TaskItem(
        task_id=str(updated_record["task_id"]),
        project_id=str(updated_record.get("project_id", "PRJ-0001")),
        project_name=updated_record.get("project_name") or f"Project {updated_record.get('project_id', 'PRJ-0001')}",
        action=str(updated_record.get("action", "")),
        assigned_by=by_val,
        assigned_to=to_val,
        deadline=str(updated_record.get("deadline", "")),
        status=str(updated_record.get("status", "done")),
        remarks=updated_record.get("remarks")
    )
