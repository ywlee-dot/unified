"""API router for Report Generator project (n8n)."""

from fastapi import APIRouter, HTTPException

from app.projects.report_generator.schemas import N8nTriggerRequest
from app.projects.report_generator.service import ReportGeneratorService

router = APIRouter()

_service = ReportGeneratorService()


@router.get("/workflows")
async def list_workflows():
    return await _service.get_workflows()


@router.post("/trigger/{workflow_id}")
async def trigger_workflow(workflow_id: str, data: N8nTriggerRequest | None = None):
    params = data.parameters if data else {}
    result = await _service.trigger_workflow(workflow_id, params)
    if result.status == "failed":
        raise HTTPException(status_code=404, detail=result.message)
    return result


@router.get("/runs")
async def list_runs(page: int = 1, page_size: int = 20):
    return await _service.get_runs(page=page, page_size=page_size)


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    run = await _service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="실행 기록을 찾을 수 없습니다")
    return run


@router.get("/runs/{run_id}/download")
async def download_run_result(run_id: str):
    result = await _service.get_run_download(run_id)
    if not result:
        raise HTTPException(status_code=404, detail="다운로드할 리포트를 찾을 수 없습니다")
    return result
