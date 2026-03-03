"""Business logic service for Data Pipeline project (n8n)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.projects.data_pipeline.dummy_data import get_dummy_pipelines
from app.projects.data_pipeline.schemas import Pipeline, PipelineRun, PipelineTriggerRequest
from app.shared.models.n8n_execution import N8nExecutionModel
from app.shared.services.n8n_client import (
    N8nClient,
    create_execution_record,
    get_execution,
    list_executions_from_db,
)


class DataPipelineService:
    """Service with real n8n integration backed by DB execution records."""

    def __init__(self, n8n_client: N8nClient, db: AsyncSession):
        self.n8n_client = n8n_client
        self.db = db

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
        dry_run = request.dry_run if request else False
        payload = {
            "pipeline_id": pipeline_id,
            "parameters": request.parameters if request else {},
            "dry_run": dry_run,
        }
        result = await self.n8n_client.trigger_webhook(
            f"/data-pipeline/{pipeline_id}",
            payload=payload,
        )
        if result.status == "failed":
            return {
                "success": False,
                "message": result.message,
            }
        # Create DB record for tracking
        await create_execution_record(
            self.db,
            execution_id=result.run_id,
            project_slug="data-pipeline",
            workflow_id=pipeline_id,
            workflow_name=pipeline.name,
        )
        return {
            "success": True,
            "run_id": result.run_id,
            "pipeline_id": pipeline_id,
            "pipeline_name": pipeline.name,
            "status": "triggered",
            "dry_run": dry_run,
            "message": f"파이프라인 '{pipeline.name}' {'(Dry Run) ' if dry_run else ''}실행이 시작되었습니다",
        }

    async def get_runs(self, page: int = 1, page_size: int = 20) -> dict:
        data = await list_executions_from_db(
            self.db, project_slug="data-pipeline", page=page, page_size=page_size,
        )
        data["items"] = [self._model_to_run(m) for m in data["items"]]
        return data

    async def get_run(self, run_id: str) -> PipelineRun | None:
        record = await get_execution(self.db, run_id)
        if not record or record.project_slug != "data-pipeline":
            return None
        return self._model_to_run(record)

    async def get_run_logs(self, run_id: str) -> dict | None:
        record = await get_execution(self.db, run_id)
        if not record or record.project_slug != "data-pipeline":
            return None
        run = self._model_to_run(record)
        logs: list[str] = []
        result_data = record.result_data
        if result_data and isinstance(result_data, dict):
            run_data = result_data.get("resultData", {}).get("runData", {})
            for node_name, node_runs in run_data.items():
                for node_run in node_runs:
                    if isinstance(node_run, dict):
                        status = node_run.get("executionStatus", "unknown")
                        logs.append(f"[{node_name}] status={status}")
        if not logs:
            logs = ["로그가 없습니다"]
        return {
            "run_id": run_id,
            "pipeline_name": run.pipeline_name,
            "status": run.status,
            "logs": logs,
        }

    @staticmethod
    def _model_to_run(record: N8nExecutionModel) -> PipelineRun:
        """Convert DB model to PipelineRun schema."""
        return PipelineRun(
            run_id=record.execution_id,
            pipeline_id=record.workflow_id,
            pipeline_name=record.workflow_name,
            status=record.status,
            started_at=record.started_at,
            finished_at=record.finished_at,
            error_message=record.error_message,
        )
