"""Business logic service for Summarize project (n8n)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.projects.summarize.schemas import SummarizeRun, SummarizeTriggerResponse
from app.shared.models.n8n_execution import N8nExecutionModel
from app.shared.services.n8n_client import (
    N8nClient,
    create_execution_record,
    get_execution,
    list_executions_from_db,
)


class SummarizeService:
    """Service with real n8n integration backed by DB execution records."""

    def __init__(self, n8n_client: N8nClient, db: AsyncSession):
        self.n8n_client = n8n_client
        self.db = db

    async def trigger(self, text: str = "", parameters: dict | None = None) -> SummarizeTriggerResponse:
        payload = {"text": text, **(parameters or {})}
        result = await self.n8n_client.trigger_webhook(
            "/summarize",
            payload=payload,
        )
        if result.status == "failed":
            return SummarizeTriggerResponse(
                run_id="", status="failed", message=result.message,
            )
        await create_execution_record(
            self.db,
            execution_id=result.run_id,
            project_slug="summarize",
            workflow_id="summarize",
            workflow_name="텍스트 요약",
        )
        return SummarizeTriggerResponse(
            run_id=result.run_id,
            status=result.status,
            message="요약 워크플로우가 실행되었습니다",
        )

    async def get_runs(self, page: int = 1, page_size: int = 20) -> dict:
        data = await list_executions_from_db(
            self.db, project_slug="summarize", page=page, page_size=page_size,
        )
        data["items"] = [self._model_to_run(m) for m in data["items"]]
        return data

    async def get_run(self, run_id: str) -> SummarizeRun | None:
        record = await get_execution(self.db, run_id)
        if not record or record.project_slug != "summarize":
            return None
        return self._model_to_run(record)

    @staticmethod
    def _model_to_run(record: N8nExecutionModel) -> SummarizeRun:
        return SummarizeRun(
            run_id=record.execution_id,
            workflow_id=record.workflow_id,
            workflow_name=record.workflow_name,
            status=record.status,
            started_at=record.started_at,
            finished_at=record.finished_at,
            result_data=record.result_data,
            error_message=record.error_message,
        )
