"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import dispose_engine
from app.exceptions import register_exception_handlers
from app.registry.project_registry import ProjectRegistry
from app.shared.auth.router import router as auth_router
from app.shared.routers.n8n_webhook import router as n8n_webhook_router

# Logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Startup
    logger.info("Starting Unified Workspace API")
    yield
    # Shutdown
    logger.info("Shutting down — disposing DB engine")
    await dispose_engine()


app = FastAPI(
    title="Unified Workspace API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth router
app.include_router(auth_router, prefix="/api/auth", tags=["인증"])

# n8n callback webhook
app.include_router(n8n_webhook_router, prefix="/api/webhooks/n8n", tags=["n8n 콜백"])

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
    return {"success": True, "data": registry.get_all_projects()}


@app.get("/api/registry/projects/{slug}", tags=["레지스트리"])
async def get_project(slug: str):
    project = registry.get_project(slug)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(404, detail="프로젝트를 찾을 수 없습니다")
    return {"success": True, "data": project}


# Auto-discover and register project modules
registry.auto_discover_and_register(app, prefix="/api/projects")
