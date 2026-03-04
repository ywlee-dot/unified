"""API router for Summarize project (n8n)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_n8n_client
from app.projects.summarize.schemas import SummarizeTriggerRequest
from app.projects.summarize.service import SummarizeService
from app.shared.services.n8n_client import N8nClient

router = APIRouter()


def _get_service(
    n8n_client: N8nClient = Depends(get_n8n_client),
    db: AsyncSession = Depends(get_db),
) -> SummarizeService:
    return SummarizeService(n8n_client, db)


@router.post("/trigger")
async def trigger_summarize(
    data: SummarizeTriggerRequest | None = None,
    service: SummarizeService = Depends(_get_service),
):
    text = data.text if data else ""
    params = data.parameters if data else {}
    result = await service.trigger(text, params)
    if result.status == "failed":
        raise HTTPException(status_code=500, detail=result.message)
    return result


@router.get("/runs")
async def list_runs(
    page: int = 1,
    page_size: int = 20,
    service: SummarizeService = Depends(_get_service),
):
    return await service.get_runs(page=page, page_size=page_size)


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    service: SummarizeService = Depends(_get_service),
):
    run = await service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="실행 기록을 찾을 수 없습니다")
    return run
