"""Business logic service for Data Pipeline project (n8n)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.projects.data_pipeline.dummy_data import get_dummy_pipelines, get_dummy_runs
from app.projects.data_pipeline.schemas import Pipeline, PipelineRun, PipelineTriggerRequest


class DataPipelineService:
    """Service with mock n8n integration for scaffold."""

    async def get_pipelines(self) -> list[Pipeline]:
        return get_dummy_pipelines()

    async def get_pipeline(self, pipeline_id: str) -> Pipeline | None:
        for p in get_dummy_pipelines():
            if p.id == pipeline_id:
                return p
        return None

    async def trigger_pipeline(
        self, pipeline_id: str, request: PipelineTriggerRequest | None = None
    ) -> dict:
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return {
                "success": False,
                "message": f"파이프라인을 찾을 수 없습니다: {pipeline_id}",
            }
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        dry_run = request.dry_run if request else False
        return {
            "success": True,
            "run_id": run_id,
            "pipeline_id": pipeline_id,
            "pipeline_name": pipeline.name,
            "status": "triggered",
            "dry_run": dry_run,
            "message": f"파이프라인 '{pipeline.name}' {'(Dry Run) ' if dry_run else ''}실행이 시작되었습니다",
        }

    async def get_runs(self, page: int = 1, page_size: int = 20) -> dict:
        runs = get_dummy_runs()
        total = len(runs)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": runs[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    async def get_run(self, run_id: str) -> PipelineRun | None:
        for run in get_dummy_runs():
            if run.run_id == run_id:
                return run
        return None

    async def get_run_logs(self, run_id: str) -> dict | None:
        run = await self.get_run(run_id)
        if not run:
            return None
        return {
            "run_id": run_id,
            "pipeline_name": run.pipeline_name,
            "status": run.status,
            "logs": run.logs or ["로그가 없습니다"],
        }
