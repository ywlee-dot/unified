"""API router for Data Pipeline project (n8n)."""

from fastapi import APIRouter, HTTPException

from app.projects.data_pipeline.schemas import PipelineTriggerRequest
from app.projects.data_pipeline.service import DataPipelineService

router = APIRouter()

_service = DataPipelineService()


@router.get("/pipelines")
async def list_pipelines():
    return await _service.get_pipelines()


@router.post("/pipelines/{pipeline_id}/trigger")
async def trigger_pipeline(pipeline_id: str, data: PipelineTriggerRequest | None = None):
    result = await _service.trigger_pipeline(pipeline_id, data)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
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


@router.get("/runs/{run_id}/logs")
async def get_run_logs(run_id: str):
    logs = await _service.get_run_logs(run_id)
    if not logs:
        raise HTTPException(status_code=404, detail="실행 기록을 찾을 수 없습니다")
    return logs
