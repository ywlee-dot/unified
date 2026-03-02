"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.exceptions import register_exception_handlers
from app.registry.project_registry import ProjectRegistry
from app.shared.auth.router import router as auth_router

app = FastAPI(
    title="Unified Workspace API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth router
app.include_router(auth_router, prefix="/api/auth", tags=["인증"])

# Exception handlers
register_exception_handlers(app)

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}

# Project registry
registry = ProjectRegistry()


@app.get("/api/registry/projects", tags=["레지스트리"])
async def list_projects():
    return registry.get_all_projects()


@app.get("/api/registry/projects/{slug}", tags=["레지스트리"])
async def get_project(slug: str):
    project = registry.get_project(slug)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(404, "프로젝트를 찾을 수 없습니다")
    return project


# Auto-discover and register project modules
registry.auto_discover_and_register(app, prefix="/api/projects")
