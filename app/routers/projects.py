from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Project, ProjectMember, Task, User, RoleEnum, StatusEnum
from ..schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectListResponse, MemberCreate, MemberResponse
)
from ..dependencies import (
    get_current_user, get_project_membership, require_project_admin, require_account_admin
)

router = APIRouter()


@router.get("/", response_model=List[ProjectListResponse])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    memberships = (
        db.query(ProjectMember)
        .filter(ProjectMember.user_id == current_user.id)
        .options(joinedload(ProjectMember.project))
        .all()
    )
    result = []
    for m in memberships:
        p = m.project
        total = db.query(Task).filter(Task.project_id == p.id).count()
        done = db.query(Task).filter(Task.project_id == p.id, Task.status == StatusEnum.DONE).count()
        member_count = db.query(ProjectMember).filter(ProjectMember.project_id == p.id).count()
        result.append(ProjectListResponse(
            id=p.id, name=p.name, description=p.description,
            owner_id=p.owner_id, created_at=p.created_at,
            member_count=member_count, task_count=total, done_count=done,
            my_role=m.role,
        ))
    return result


@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(require_account_admin),
    db: Session = Depends(get_db)
):
    project = Project(name=payload.name, description=payload.description, owner_id=current_user.id)
    db.add(project)
    db.flush()
    membership = ProjectMember(project_id=project.id, user_id=current_user.id, role=RoleEnum.ADMIN)
    db.add(membership)
    db.commit()
    project = (
        db.query(Project)
        .options(joinedload(Project.members).joinedload(ProjectMember.user))
        .filter(Project.id == project.id)
        .first()
    )
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_project_membership(project_id, current_user, db)
    project = db.query(Project).options(
        joinedload(Project.members).joinedload(ProjectMember.user)
    ).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    require_project_admin(project_id, current_user, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    require_project_admin(project_id, current_user, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()


@router.post("/{project_id}/members", response_model=MemberResponse, status_code=201)
def add_member(
    project_id: int,
    payload: MemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    require_project_admin(project_id, current_user, db)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")
    member = ProjectMember(project_id=project_id, user_id=user.id, role=payload.role)
    db.add(member)
    db.commit()
    member = (
        db.query(ProjectMember)
        .options(joinedload(ProjectMember.user))
        .filter(ProjectMember.id == member.id)
        .first()
    )
    return member


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(
    project_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    require_project_admin(project_id, current_user, db)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
