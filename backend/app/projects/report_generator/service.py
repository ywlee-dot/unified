"""Business logic service for Report Generator project (n8n)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.projects.report_generator.dummy_data import get_dummy_workflows
from app.projects.report_generator.schemas import (
    N8nRunResult,
    N8nTriggerResponse,
    N8nWorkflow,
)
from app.shared.models.n8n_execution import N8nExecutionModel
from app.shared.services.n8n_client import (
    N8nClient,
    create_execution_record,
    get_execution,
    list_executions_from_db,
)


class ReportGeneratorService:
    """Service with real n8n integration backed by DB execution records."""

    def __init__(self, n8n_client: N8nClient, db: AsyncSession):
        self.n8n_client = n8n_client
        self.db = db

    async def get_workflows(self) -> list[N8nWorkflow]:
        return get_dummy_workflows()

    async def trigger_workflow(self, workflow_id: str, parameters: dict | None = None) -> N8nTriggerResponse:
        workflows = get_dummy_workflows()
        workflow = next((w for w in workflows if w.id == workflow_id), None)
        if not workflow:
            return N8nTriggerResponse(
                run_id="", status="failed",
                message=f"워크플로우를 찾을 수 없습니다: {workflow_id}",
            )
        result = await self.n8n_client.trigger_webhook(
            f"/report-generator/{workflow_id}",
            payload=parameters or {},
        )
        if result.status == "failed":
            return N8nTriggerResponse(
                run_id="", status="failed", message=result.message,
            )
        # Create DB record for tracking
        await create_execution_record(
            self.db,
            execution_id=result.run_id,
            project_slug="report-generator",
            workflow_id=workflow_id,
            workflow_name=workflow.name,
        )
        return N8nTriggerResponse(
            run_id=result.run_id,
            status=result.status,
            message=f"'{workflow.name}' 워크플로우가 실행되었습니다",
        )

    async def get_runs(self, page: int = 1, page_size: int = 20) -> dict:
        data = await list_executions_from_db(
            self.db, project_slug="report-generator", page=page, page_size=page_size,
        )
        data["items"] = [self._model_to_run(m) for m in data["items"]]
        return data

    async def get_run(self, run_id: str) -> N8nRunResult | None:
        record = await get_execution(self.db, run_id)
        if not record or record.project_slug != "report-generator":
            return None
        return self._model_to_run(record)

    async def get_run_download(self, run_id: str) -> dict | None:
        run = await self.get_run(run_id)
        if not run or not run.result_data:
            return None
        return {
            "run_id": run_id,
            "download_url": run.result_data.get("report_url", ""),
            "message": "리포트 다운로드 URL입니다",
        }

    @staticmethod
    def _model_to_run(record: N8nExecutionModel) -> N8nRunResult:
        """Convert DB model to N8nRunResult schema."""
        return N8nRunResult(
            run_id=record.execution_id,
            workflow_id=record.workflow_id,
            workflow_name=record.workflow_name,
            status=record.status,
            started_at=record.started_at,
            finished_at=record.finished_at,
            result_data=record.result_data,
            error_message=record.error_message,
        )
