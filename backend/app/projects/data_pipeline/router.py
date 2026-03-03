"""API router for Data Pipeline project (n8n)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_n8n_client
from app.projects.data_pipeline.schemas import PipelineTriggerRequest
from app.projects.data_pipeline.service import DataPipelineService
from app.shared.services.n8n_client import N8nClient

router = APIRouter()


def _get_service(
    n8n_client: N8nClient = Depends(get_n8n_client),
    db: AsyncSession = Depends(get_db),
) -> DataPipelineService:
    return DataPipelineService(n8n_client, db)


@router.get("/pipelines")
async def list_pipelines(service: DataPipelineService = Depends(_get_service)):
    return await service.get_pipelines()


@router.post("/pipelines/{pipeline_id}/trigger")
async def trigger_pipeline(
    pipeline_id: str,
    data: PipelineTriggerRequest | None = None,
    service: DataPipelineService = Depends(_get_service),
):
    result = await service.trigger_pipeline(pipeline_id, data)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.get("/runs")
async def list_runs(
    page: int = 1,
    page_size: int = 20,
    service: DataPipelineService = Depends(_get_service),
):
    return await service.get_runs(page=page, page_size=page_size)


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    service: DataPipelineService = Depends(_get_service),
):
    run = await service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="실행 기록을 찾을 수 없습니다")
    return run


@router.get("/runs/{run_id}/logs")
async def get_run_logs(
    run_id: str,
    service: DataPipelineService = Depends(_get_service),
):
    logs = await service.get_run_logs(run_id)
    if not logs:
        raise HTTPException(status_code=404, detail="실행 기록을 찾을 수 없습니다")
    return logs
