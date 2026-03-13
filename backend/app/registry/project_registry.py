"""Project registry for auto-discovering and registering project modules."""

from __future__ import annotations

import importlib
import logging
from pathlib import Path

from fastapi import Depends, FastAPI
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_user, get_optional_user

logger = logging.getLogger(__name__)

# Evaluated at module load time. Changing AUTH_REQUIRED requires a backend restart.
auth_dep = Depends(get_current_user if settings.AUTH_REQUIRED else get_optional_user)


class ProjectManifest(BaseModel):
    slug: str
    name: str
    description: str
    version: str = "1.0.0"
    project_type: str  # "standard" | "n8n"
    icon: str
    color: str
    enabled: bool = True
    router_module: str
    n8n_config: dict | None = None


class ProjectRegistry:
    def __init__(self) -> None:
        self._projects: dict[str, ProjectManifest] = {}

    def auto_discover_and_register(self, app: FastAPI, prefix: str) -> None:
        """Scan backend/app/projects/ for manifest.py files and register routers."""
        projects_dir = Path(__file__).parent.parent / "projects"
        if not projects_dir.exists():
            logger.warning("Projects directory not found: %s", projects_dir)
            return

        for child in sorted(projects_dir.iterdir()):
            if not child.is_dir() or child.name.startswith("_"):
                continue
            manifest_path = child / "manifest.py"
            if not manifest_path.exists():
                continue
            try:
                module_name = f"app.projects.{child.name}.manifest"
                mod = importlib.import_module(module_name)
                manifest: ProjectManifest = mod.manifest
                if not manifest.enabled:
                    logger.info("Skipping disabled project: %s", manifest.slug)
                    continue
                self._projects[manifest.slug] = manifest

                router_mod = importlib.import_module(manifest.router_module)
                router = router_mod.router
                app.include_router(
                    router,
                    prefix=f"{prefix}/{manifest.slug}",
                    tags=[manifest.name],
                    dependencies=[auth_dep],
                )
                logger.info("Registered project: %s (%s)", manifest.slug, manifest.name)
            except Exception:
                logger.exception("Failed to register project from %s", child.name)

    def get_all_projects(self) -> list[ProjectManifest]:
        return list(self._projects.values())

    def get_project(self, slug: str) -> ProjectManifest | None:
        return self._projects.get(slug)
