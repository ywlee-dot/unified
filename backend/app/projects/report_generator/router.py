"""API router for Report Generator project (n8n)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_n8n_client
from app.projects.report_generator.schemas import N8nTriggerRequest
from app.projects.report_generator.service import ReportGeneratorService
from app.shared.services.n8n_client import N8nClient

router = APIRouter()


def _get_service(
    n8n_client: N8nClient = Depends(get_n8n_client),
    db: AsyncSession = Depends(get_db),
) -> ReportGeneratorService:
    return ReportGeneratorService(n8n_client, db)


@router.get("/workflows")
async def list_workflows(service: ReportGeneratorService = Depends(_get_service)):
    return await service.get_workflows()


@router.post("/trigger/{workflow_id}")
async def trigger_workflow(
    workflow_id: str,
    data: N8nTriggerRequest | None = None,
    service: ReportGeneratorService = Depends(_get_service),
):
    params = data.parameters if data else {}
    result = await service.trigger_workflow(workflow_id, params)
    if result.status == "failed":
        raise HTTPException(status_code=404, detail=result.message)
    return result


@router.get("/runs")
async def list_runs(
    page: int = 1,
    page_size: int = 20,
    service: ReportGeneratorService = Depends(_get_service),
):
    return await service.get_runs(page=page, page_size=page_size)


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    service: ReportGeneratorService = Depends(_get_service),
):
    run = await service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="실행 기록을 찾을 수 없습니다")
    return run


@router.get("/runs/{run_id}/download")
async def download_run_result(
    run_id: str,
    service: ReportGeneratorService = Depends(_get_service),
):
    result = await service.get_run_download(run_id)
    if not result:
        raise HTTPException(status_code=404, detail="다운로드할 리포트를 찾을 수 없습니다")
    return result
