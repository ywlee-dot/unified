"""공공데이터 활용도 제고 정성보고서 API 라우터 — n8n 웹훅 연동."""

import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.shared.services.n8n_client import (
    create_execution_record,
    get_execution,
    list_executions_from_db,
)

logger = logging.getLogger(__name__)

router = APIRouter()

WEBHOOK_URL = "http://168.107.58.30/webhook/data_utilization_report"
PROJECT_SLUG = "data-utilization-report"
WORKFLOW_ID = "data-utilization-report-main"
WORKFLOW_NAME = "공공데이터 활용도 제고 정성보고서 작성"


@router.post("/trigger/{workflow_id}", summary="정성보고서 생성 실행 (PDF 업로드)")
async def trigger_workflow(
    workflow_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """증빙자료(PDF)를 업로드하면 n8n 워크플로우를 트리거합니다."""
    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일(.pdf)만 업로드 가능합니다.")

    tracking_id = str(uuid.uuid4())
    file_content = await file.read()

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                WEBHOOK_URL,
                files={"file": (file.filename, file_content, file.content_type)},
                data={"tracking_id": tracking_id},
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error("n8n webhook error: %s %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=502, detail=f"n8n 워크플로우 호출 실패: {e.response.status_code}")
    except httpx.RequestError as e:
        logger.error("n8n webhook connection error: %s", e)
        raise HTTPException(status_code=502, detail=f"n8n 서버 연결 실패: {e}")

    await create_execution_record(
        db,
        execution_id=tracking_id,
        project_slug=PROJECT_SLUG,
        workflow_id=workflow_id,
        workflow_name=WORKFLOW_NAME,
    )

    return {
        "success": True,
        "data": {
            "run_id": tracking_id,
            "status": "triggered",
            "message": f"워크플로우 '{workflow_id}' 실행이 요청되었습니다.",
        },
    }


@router.get("/runs/{execution_id}", summary="실행 상태 조회")
async def get_run_status(
    execution_id: str,
    db: AsyncSession = Depends(get_db),
):
    """특정 실행의 상태를 조회합니다."""
    record = await get_execution(db, execution_id)
    if not record:
        raise HTTPException(status_code=404, detail="실행 기록을 찾을 수 없습니다.")

    download_url = None
    if record.result_data and record.result_data.get("download_url"):
        download_url = record.result_data["download_url"]

    return {
        "run_id": record.execution_id,
        "workflow_id": record.workflow_id,
        "workflow_name": record.workflow_name,
        "status": record.status,
        "started_at": record.started_at.isoformat() if record.started_at else None,
        "finished_at": record.finished_at.isoformat() if record.finished_at else None,
        "result_data": record.result_data,
        "download_url": download_url,
        "error_message": record.error_message,
    }


@router.get("/runs", summary="실행 이력 목록")
async def get_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """정성보고서 생성 실행 이력을 DB에서 조회합니다."""
    result = await list_executions_from_db(db, PROJECT_SLUG, page, page_size)
    return {"success": True, "data": result}
