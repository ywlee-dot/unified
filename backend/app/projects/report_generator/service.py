"""Business logic service for Report Generator project (n8n)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.projects.report_generator.dummy_data import get_dummy_runs, get_dummy_workflows
from app.projects.report_generator.schemas import (
    N8nRunResult,
    N8nTriggerResponse,
    N8nWorkflow,
)


class ReportGeneratorService:
    """Service with mock n8n integration for scaffold."""

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
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        return N8nTriggerResponse(
            run_id=run_id, status="triggered",
            message=f"'{workflow.name}' 워크플로우가 실행되었습니다",
        )

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

    async def get_run(self, run_id: str) -> N8nRunResult | None:
        for run in get_dummy_runs():
            if run.run_id == run_id:
                return run
        return None

    async def get_run_download(self, run_id: str) -> dict | None:
        run = await self.get_run(run_id)
        if not run or not run.result_data:
            return None
        return {
            "run_id": run_id,
            "download_url": run.result_data.get("report_url", ""),
            "message": "리포트 다운로드 URL입니다 (scaffold - 실제 파일 없음)",
        }
