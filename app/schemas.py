from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from .models import RoleEnum, StatusEnum, PriorityEnum


# ── Auth ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    account_role: RoleEnum = RoleEnum.MEMBER


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    account_role: RoleEnum


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    account_role: RoleEnum
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Project Members ──────────────────────────────────────────────────────────

class MemberCreate(BaseModel):
    email: str
    role: RoleEnum = RoleEnum.MEMBER


class MemberResponse(BaseModel):
    id: int
    user_id: int
    role: RoleEnum
    user: UserResponse

    class Config:
        from_attributes = True


# ── Projects ─────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    created_at: datetime
    members: List[MemberResponse] = []

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    created_at: datetime
    member_count: int
    task_count: int
    done_count: int
    my_role: RoleEnum

    class Config:
        from_attributes = True


# ── Tasks ─────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    status: StatusEnum = StatusEnum.TODO
    priority: PriorityEnum = PriorityEnum.MEDIUM
    due_date: Optional[date] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    status: Optional[StatusEnum] = None
    priority: Optional[PriorityEnum] = None
    due_date: Optional[date] = None


class TaskStatusUpdate(BaseModel):
    status: StatusEnum


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    project_id: int
    assignee_id: Optional[int]
    status: str
    priority: str
    due_date: Optional[date]
    created_at: datetime
    assignee: Optional[UserResponse] = None

    class Config:
        from_attributes = True


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_tasks: int
    in_progress: int
    done: int
    overdue: int
    my_tasks: List[TaskResponse]
