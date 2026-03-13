"""
업무규칙 자동 생성 API 라우터 (n8n)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.shared.schemas.common import ApiResponse
from .service import Business_rule_genService
from .dummy_data import get_dummy_workflows

router = APIRouter()


@router.get("/workflows", summary="워크플로우 목록")
async def get_workflows():
    return ApiResponse(success=True, data=get_dummy_workflows())


@router.post("/trigger/{workflow_id}", summary="워크플로우 트리거")
async def trigger_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = Business_rule_genService(db)
    result = await service.trigger_workflow(workflow_id, {})
    return ApiResponse(success=True, data=result)


@router.get("/runs", summary="실행 이력")
async def get_runs(db: AsyncSession = Depends(get_db)):
    service = Business_rule_genService(db)
    runs = await service.get_runs()
    return ApiResponse(success=True, data=runs)
