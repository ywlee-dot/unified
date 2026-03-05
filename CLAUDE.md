# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A monorepo scaffold system ("Unified Workspace") integrating 6 independent projects under a single FastAPI backend + Next.js frontend, orchestrated via Docker Compose. All services run in containers — there is no local venv/node_modules workflow by default.

## Commands

### Starting / Stopping Services

```bash
docker compose up -d          # Start all services
docker compose down            # Stop all services
docker compose down -v         # Stop and destroy all data volumes
docker compose restart         # Restart all services
```

### Backend Development

```bash
docker compose exec backend bash                              # Shell into backend container
docker compose logs -f backend                                # Tail backend logs
docker compose build backend && docker compose up -d backend  # Rebuild after dependency changes

# DB migrations (run inside backend container or via exec)
docker compose exec backend alembic revision --autogenerate -m "description"
docker compose exec backend alembic upgrade head
```

### Frontend Development

```bash
docker compose exec frontend bash    # Shell into frontend container
docker compose logs -f frontend      # Tail frontend logs
```

### Linting / Type Checking

```bash
# Frontend
docker compose exec frontend npx next lint

# Backend — no linter configured yet; use pytest for validation
docker compose exec backend python -m pytest tests/
```

### Seed Data

```bash
docker compose exec backend python -m scripts.seed_data
```

### Health Check

```bash
./scripts/health_check.sh
```

### Add a New Project

```bash
./scripts/create_project.sh <slug> "<display-name>" <standard|n8n>
```

## Architecture

### Service Topology

```
Browser → Next.js (:3000) → FastAPI (:8000) → PostgreSQL (:5432)
                                             → Redis (:6379)
                                             → n8n (:5678)
```

The frontend uses `NEXT_PUBLIC_API_URL` (client-side) and `INTERNAL_API_URL` (server-side SSR) to reach the backend. The API client in `frontend/src/lib/api.ts` selects the correct base URL depending on the runtime environment.

### Backend (FastAPI + SQLAlchemy async)

- **Entry point**: `backend/app/main.py` — mounts CORS, auth router, exception handlers, and the project registry.
- **Config**: `backend/app/config.py` — `pydantic-settings` loading from env vars.
- **Database**: `backend/app/database.py` — async SQLAlchemy engine + session factory. Inject via `Depends(get_db)`.
- **Models base**: `backend/app/shared/models/base.py` — `BaseEntity` with UUID PK + `TimestampMixin` (`created_at`/`updated_at`).
- **Auth**: `backend/app/shared/auth/` — JWT-based, scaffold-level (hardcoded test user). Auth is optional on project endpoints.
- **Dependencies**: `backend/app/dependencies.py` — common FastAPI `Depends` providers (`get_db_session`, `get_current_user`, `get_n8n_client`).
- **Exceptions**: `backend/app/exceptions.py` — `ProjectNotFoundError` / `ProjectValidationError` with global handlers.
- **n8n Client**: `backend/app/shared/services/n8n_client.py` — HTTP client for triggering n8n webhooks.

### Project Registry Pattern (critical to understand)

Each project lives under `backend/app/projects/<slug>/` with a standard layout:

```
<slug>/
├── __init__.py
├── manifest.py      # ProjectManifest — slug, name, type, router_module, n8n_config
├── router.py        # FastAPI APIRouter (mounted at /api/projects/<slug>)
├── service.py       # Business logic (currently returns dummy data)
├── schemas.py       # Pydantic request/response models
├── models.py        # SQLAlchemy ORM models (standard projects only)
└── dummy_data.py    # Static seed data for scaffold
```

On startup, `ProjectRegistry.auto_discover_and_register()` scans `backend/app/projects/`, imports each `manifest.py`, and mounts its router at `/api/projects/{slug}`. To add a project, create the directory with a `manifest.py` — no manual registration needed.

**Two project types**:
- `standard` — CRUD endpoints backed by DB models (data-collector, analytics, notifications, content-manager)
- `n8n` — trigger/poll endpoints that delegate to n8n webhooks (report-generator, data-pipeline). The manifest includes `n8n_config` with webhook paths and workflow definitions.

### Frontend (Next.js 15 / App Router)

- **Layout**: `frontend/src/app/layout.tsx` — Sidebar + Header shell wrapping all pages.
- **Providers**: `frontend/src/app/providers.tsx` — React Query (`@tanstack/react-query`) + ErrorBoundary.
- **API client**: `frontend/src/lib/api.ts` — `ApiClient` class with typed methods for registry, project data, and n8n triggers.
- **Types**: `frontend/src/lib/types.ts` — all shared TypeScript interfaces (mirrors backend schemas).
- **Hooks**: `frontend/src/hooks/` — `useProjectData` / `useProjectPaginatedData` (React Query wrappers), `useProjects` (registry), `useN8nTrigger` (n8n workflow trigger + polling).
- **Components**: `frontend/src/components/` — `layout/` (Sidebar, Header, ProjectCard, BreadcrumbNav), `shared/` (DataTable, StatusBadge, LoadingSpinner, EmptyState, ErrorBoundary), `n8n/` (TriggerButton, PipelineStatus, ResultViewer).
- **Pages**: Each project has pages under `frontend/src/app/projects/<slug>/`.
- **Path alias**: `@/*` maps to `./src/*`.

### Key Conventions

- All API routes are prefixed with `/api/`. Project-specific routes are `/api/projects/<slug>/*`.
- Backend services currently return dummy data; replace with real DB queries via async SQLAlchemy sessions.
- Korean language is used for UI strings, error messages, and documentation.
- Pydantic v2 for all backend schemas. SQLAlchemy 2.0 mapped_column style for models.
- Tests use `pytest` + `pytest-asyncio` with `asyncio_mode = "auto"` (see `pyproject.toml`).

### Frontend-Backend Type Synchronization

When adding or modifying API schemas:

1. Update backend Pydantic schemas in `backend/app/projects/<slug>/schemas.py`
2. Mirror changes to `frontend/src/lib/types.ts` (keep field names identical)
3. Verify `ApiResponse<T>` wrapper is used consistently in both backend responses and frontend API client
4. Optional: use `openapi-typescript` to auto-generate types from `http://localhost:8000/api/openapi.json`

```bash
# Auto-generate TypeScript types from OpenAPI schema (optional)
npx openapi-typescript http://localhost:8000/api/openapi.json -o frontend/src/lib/api-types.ts
```
