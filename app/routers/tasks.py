from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Task, ProjectMember, User, StatusEnum, RoleEnum
from ..schemas import TaskCreate, TaskUpdate, TaskStatusUpdate, TaskResponse, DashboardStats
from ..dependencies import (
    get_current_user, get_project_membership, require_project_admin
)

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    my_tasks = (
        db.query(Task)
        .filter(Task.assignee_id == current_user.id)
        .options(joinedload(Task.assignee))
        .order_by(Task.due_date.asc().nulls_last())
        .all()
    )
    today = date.today()
    total = len(my_tasks)
    in_progress = sum(1 for t in my_tasks if t.status == StatusEnum.IN_PROGRESS)
    done = sum(1 for t in my_tasks if t.status == StatusEnum.DONE)
    overdue = sum(
        1 for t in my_tasks
        if t.due_date and t.due_date < today and t.status != StatusEnum.DONE
    )
    return DashboardStats(
        total_tasks=total,
        in_progress=in_progress,
        done=done,
        overdue=overdue,
        my_tasks=my_tasks,
    )


@router.get("/project/{project_id}", response_model=List[TaskResponse])
def get_project_tasks(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_project_membership(project_id, current_user, db)
    tasks = (
        db.query(Task)
        .filter(Task.project_id == project_id)
        .options(joinedload(Task.assignee))
        .order_by(Task.created_at.desc())
        .all()
    )
    return tasks


@router.post("/project/{project_id}", response_model=TaskResponse, status_code=201)
def create_task(
    project_id: int,
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    require_project_admin(project_id, current_user, db)
    task = Task(
        title=payload.title,
        description=payload.description,
        project_id=project_id,
        assignee_id=payload.assignee_id,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    if task.assignee_id:
        db.refresh(task)
        task = db.query(Task).options(joinedload(Task.assignee)).filter(Task.id == task.id).first()
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    membership = get_project_membership(task.project_id, current_user, db)
    is_admin = membership.role == RoleEnum.ADMIN
    is_assignee = task.assignee_id == current_user.id

    if current_user.account_role != RoleEnum.ADMIN and not is_assignee:
        raise HTTPException(status_code=403, detail="Taskers can only update tasks assigned to them")

    if is_admin and current_user.account_role == RoleEnum.ADMIN:
        if payload.title is not None:
            task.title = payload.title
        if payload.description is not None:
            task.description = payload.description
        if payload.assignee_id is not None:
            task.assignee_id = payload.assignee_id
        if payload.priority is not None:
            task.priority = payload.priority
        if payload.due_date is not None:
            task.due_date = payload.due_date

    if payload.status is not None:
        task.status = payload.status

    db.commit()
    task = db.query(Task).options(joinedload(Task.assignee)).filter(Task.id == task_id).first()
    return task


@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    payload: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    membership = get_project_membership(task.project_id, current_user, db)
    is_admin = membership.role == RoleEnum.ADMIN
    is_assignee = task.assignee_id == current_user.id

    if current_user.account_role != RoleEnum.ADMIN and not is_assignee:
        raise HTTPException(status_code=403, detail="Taskers can only update tasks assigned to them")

    task.status = payload.status
    db.commit()
    task = db.query(Task).options(joinedload(Task.assignee)).filter(Task.id == task_id).first()
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    require_project_admin(task.project_id, current_user, db)
    db.delete(task)
    db.commit()
