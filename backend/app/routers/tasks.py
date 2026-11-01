"""
Tasks Router for LandSentinel.
Strictly adheres to docs/contracts.md section 3 & 5.
"""
from typing import List, Optional
from fastapi import APIRouter, Query, status, Depends
from app.schemas import TaskCreateRequest, TaskCreateResponse, TaskItem, TaskPatchRequest
from app.stubs import SAMPLE_TASKS
from app.auth import CurrentUser, get_current_user, require_roles
from app.services.audit import log_action

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("", response_model=TaskCreateResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreateRequest,
    user: CurrentUser = Depends(require_roles("collector", "policymaker"))
):
    new_task_id = f"TSK-000{len(SAMPLE_TASKS) + 1}"
    log_action(user.user_id, "CREATE_TASK", project_id=payload.project_id, details=payload.model_dump())
    return TaskCreateResponse(task_id=new_task_id)

@router.get("", response_model=List[TaskItem])
def list_tasks(
    mine: Optional[bool] = Query(None, description="Filter tasks assigned to current user"),
    assigned_by_me: Optional[bool] = Query(None, description="Filter tasks created by current user"),
    user: CurrentUser = Depends(get_current_user)
):
    results = []
    for t in SAMPLE_TASKS:
        if mine and t.get("assigned_to") != user.user_id:
            continue
        if assigned_by_me and t.get("assigned_by") != user.user_id:
            continue
        results.append(TaskItem(**t))
    return results

@router.patch("/{id}", response_model=TaskItem)
def update_task(
    id: str,
    payload: TaskPatchRequest,
    user: CurrentUser = Depends(require_roles("project_manager"))
):
    task = next((t for t in SAMPLE_TASKS if t["task_id"] == id), None)
    if not task:
        task = {
            "task_id": id,
            "project_id": "PRJ-0001",
            "project_name": "Pune Ring Road Sector 1",
            "action": "Expedite hearing for Stay Order",
            "assigned_by": "collector1",
            "assigned_to": user.user_id,
            "deadline": "2026-11-15",
            "status": "done",
            "remarks": "Completed as requested"
        }
    else:
        task = {**task}
        if payload.status:
            task["status"] = payload.status
        if payload.remarks:
            task["remarks"] = payload.remarks

    log_action(user.user_id, "COMPLETE_TASK", project_id=task.get("project_id"), details={"task_id": id, "status": payload.status})
    return TaskItem(**task)
