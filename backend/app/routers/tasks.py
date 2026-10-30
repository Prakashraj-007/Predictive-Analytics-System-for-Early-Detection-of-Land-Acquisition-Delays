"""
Tasks Router (Stub implementation for A4)
Strictly adheres to docs/contracts.md section 3.
"""
from typing import List, Optional
from fastapi import APIRouter, Query, status
from app.schemas import TaskCreateRequest, TaskCreateResponse, TaskItem, TaskPatchRequest
from app.stubs import SAMPLE_TASKS

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("", response_model=TaskCreateResponse, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreateRequest):
    return TaskCreateResponse(task_id="TSK-0003")

@router.get("", response_model=List[TaskItem])
def list_tasks(
    mine: Optional[bool] = Query(None, description="Filter tasks assigned to current user"),
    assigned_by_me: Optional[bool] = Query(None, description="Filter tasks created by current user")
):
    return [TaskItem(**t) for t in SAMPLE_TASKS]

@router.patch("/{id}", response_model=TaskItem)
def update_task(id: str, payload: TaskPatchRequest):
    task = next((t for t in SAMPLE_TASKS if t["task_id"] == id), None)
    if not task:
        task = {
            "task_id": id,
            "project_id": "PRJ-0001",
            "project_name": "Pune Ring Road Sector 1",
            "action": "Expedite hearing for Stay Order",
            "assigned_by": "collector1",
            "assigned_to": "pm1",
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

    return TaskItem(**task)

