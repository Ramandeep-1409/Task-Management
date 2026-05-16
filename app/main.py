import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import inspect, text

from .database import engine, Base
from . import models  # noqa: F401 — register ORM models
from .routers import auth, projects, tasks, users, ai

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")


def _migrate_account_role():
    """Add account_role column to existing SQLite/MySQL databases."""
    insp = inspect(engine)
    if "users" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    if "account_role" in cols:
        return
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN account_role VARCHAR(20) NOT NULL DEFAULT 'ADMIN'")
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate_account_role()
    yield


app = FastAPI(
    title="Team Task Manager",
    description="Role-based project and task management API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routes ────────────────────────────────────────────────────────────────
app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(tasks.router,    prefix="/api/tasks",    tags=["Tasks"])
app.include_router(users.router,    prefix="/api/users",    tags=["Users"])
app.include_router(ai.router,       prefix="/api/ai",       tags=["AI / LLM"])


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok"}


# ── Static Frontend ───────────────────────────────────────────────────────────
if os.path.exists(FRONTEND_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    app.mount("/js",  StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")),  name="js")

    @app.get("/", include_in_schema=False)
    async def index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/signup", include_in_schema=False)
    async def signup_page():
        return FileResponse(os.path.join(FRONTEND_DIR, "signup.html"))

    @app.get("/dashboard", include_in_schema=False)
    async def dashboard_page():
        return FileResponse(os.path.join(FRONTEND_DIR, "dashboard.html"))

    @app.get("/project", include_in_schema=False)
    async def project_page():
        return FileResponse(os.path.join(FRONTEND_DIR, "project.html"))
