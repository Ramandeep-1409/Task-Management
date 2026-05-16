import os
import re
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_current_user
from ..models import User

router = APIRouter()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()


class ProjectDescRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    context: Optional[str] = Field(None, max_length=500)


class TaskSuggestRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    count: int = Field(default=5, ge=1, le=10)


class TaskInsightRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = Field(None, max_length=2000)


class AIProjectDescResponse(BaseModel):
    description: str
    source: str  # "llm" | "assistant"


class AITaskSuggestResponse(BaseModel):
    tasks: List[str]
    source: str


class AITaskInsightResponse(BaseModel):
    insight: str
    source: str


def _heuristic_project_description(name: str, context: Optional[str]) -> str:
    base = (
        f"This initiative covers {name.strip()}: scope definition, stakeholder alignment, "
        f"delivery milestones, and measurable outcomes. The team will track work items, "
        f"assign ownership, and report progress through TaskFlow."
    )
    if context and context.strip():
        return f"{base}\n\nFocus: {context.strip()}"
    return base


def _heuristic_task_suggestions(project_name: str, description: Optional[str], count: int) -> List[str]:
    seeds = [
        f"Kickoff and requirements for {project_name}",
        "Stakeholder review and sign-off",
        "Core implementation / build phase",
        "Quality assurance and acceptance testing",
        "Documentation and handover",
        "Retrospective and next-iteration planning",
        "Risk review and mitigation updates",
        "Sprint planning and backlog grooming",
    ]
    if description:
        words = re.findall(r"[A-Za-z]{4,}", description.lower())[:3]
        if words:
            seeds.insert(1, f"Deliverable: {' / '.join(w.capitalize() for w in words)}")
    return seeds[:count]


def _heuristic_task_insight(title: str, description: Optional[str]) -> str:
    detail = f" Context: {description.strip()}" if description and description.strip() else ""
    return (
        f"LLM-style brief for «{title}»: break into sub-steps, set a due date, assign a tasker, "
        f"and move status as work advances. Flag blockers early for the project lead.{detail}"
    )


async def _openai_chat(prompt: str, max_tokens: int = 400) -> Optional[str]:
    if not OPENAI_API_KEY:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": 0.6,
                },
            )
            if res.status_code != 200:
                return None
            data = res.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return None


@router.post("/project-description", response_model=AIProjectDescResponse)
async def suggest_project_description(
    payload: ProjectDescRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = (
        f"Write a concise professional project description (3-4 sentences) for a team task manager. "
        f"Project name: {payload.name}. "
        f"Extra context: {payload.context or 'none'}."
    )
    text = await _openai_chat(prompt)
    if text:
        return AIProjectDescResponse(description=text, source="llm")
    return AIProjectDescResponse(
        description=_heuristic_project_description(payload.name, payload.context),
        source="assistant",
    )


@router.post("/task-suggestions", response_model=AITaskSuggestResponse)
async def suggest_tasks(
    payload: TaskSuggestRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = (
        f"List exactly {payload.count} short actionable task titles (one per line, no numbering) "
        f"for project «{payload.project_name}». Description: {payload.description or 'N/A'}."
    )
    text = await _openai_chat(prompt, max_tokens=500)
    if text:
        lines = [ln.strip().lstrip("0123456789.-) ").strip() for ln in text.splitlines() if ln.strip()]
        tasks = [ln for ln in lines if len(ln) > 2][: payload.count]
        if tasks:
            return AITaskSuggestResponse(tasks=tasks, source="llm")
    return AITaskSuggestResponse(
        tasks=_heuristic_task_suggestions(payload.project_name, payload.description, payload.count),
        source="assistant",
    )


@router.post("/task-insight", response_model=AITaskInsightResponse)
async def task_insight(
    payload: TaskInsightRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = (
        f"In 2 sentences, advise a tasker how to execute this task and when to escalate to the project lead. "
        f"Task: {payload.title}. Details: {payload.description or 'none'}."
    )
    text = await _openai_chat(prompt, max_tokens=200)
    if text:
        return AITaskInsightResponse(insight=text, source="llm")
    return AITaskInsightResponse(
        insight=_heuristic_task_insight(payload.title, payload.description),
        source="assistant",
    )
