"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi import Depends

from app.config import settings
from app.database import dispose_engine
from app.dependencies import get_current_user, get_optional_user
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


_SECRET_KEY_KNOWN_DEFAULTS = {
    "change-me-in-production",
    "dev-secret-key-change-in-production",
    "secret",
    "",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Startup
    if not settings.DEBUG and settings.SECRET_KEY in _SECRET_KEY_KNOWN_DEFAULTS:
        raise RuntimeError(
            "SECRET_KEY must be changed from default in production (DEBUG=False). "
            "Set a strong, random SECRET_KEY environment variable."
        )
    logger.info("Starting Unified Workspace API")

    # Bid Monitor 스케줄러 시작
    try:
        from app.projects.bid_monitor.core.scheduler import start_scheduler, stop_scheduler
        await start_scheduler()
    except Exception:
        logger.warning("입찰공고 모니터링 스케줄러 시작 실패 (무시)", exc_info=True)

    yield

    # Shutdown
    try:
        from app.projects.bid_monitor.core.scheduler import stop_scheduler
        await stop_scheduler()
    except Exception:
        pass
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

# Evaluated at module load time. Changing AUTH_REQUIRED requires a backend restart.
_registry_auth_dep = Depends(get_current_user if settings.AUTH_REQUIRED else get_optional_user)


@app.get("/api/registry/projects", tags=["레지스트리"], dependencies=[_registry_auth_dep])
async def list_projects():
    return {"success": True, "data": registry.get_all_projects()}


@app.get("/api/registry/projects/{slug}", tags=["레지스트리"], dependencies=[_registry_auth_dep])
async def get_project(slug: str):
    project = registry.get_project(slug)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(404, detail="프로젝트를 찾을 수 없습니다")
    return {"success": True, "data": project}


# Auto-discover and register project modules
registry.auto_discover_and_register(app, prefix="/api/projects")
