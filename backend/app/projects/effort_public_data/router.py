"""공유데이터 제공 노력 API 라우터 (n8n - 파일 업로드)"""

import uuid

from fastapi import APIRouter, Depends, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.shared.services.n8n_client import create_execution_record, get_webhook_base

router = APIRouter()


@router.post("/trigger/{workflow_id}", summary="워크플로우 트리거 (파일 업로드)")
async def trigger_workflow(
    workflow_id: str,
    file: UploadFile = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    tracking_id = str(uuid.uuid4())

    import httpx
    file_content = await file.read()

    webhook_base = get_webhook_base(n8n_account=2)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{webhook_base}/effort_public-data",
            files={"file": (file.filename, file_content, file.content_type)},
            data={"tracking_id": tracking_id},
        )
        resp.raise_for_status()

    await create_execution_record(
        db,
        execution_id=tracking_id,
        project_slug="effort-public-data",
        workflow_id=workflow_id,
        workflow_name="공유데이터 제공 노력 실행",
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
    from app.shared.services.n8n_client import get_execution
    record = await get_execution(db, execution_id)
    if not record:
        from fastapi import HTTPException
        raise HTTPException(404, "실행 기록을 찾을 수 없습니다")
    return {
        "run_id": record.execution_id,
        "workflow_id": record.workflow_id,
        "workflow_name": record.workflow_name,
        "status": record.status,
        "started_at": record.started_at.isoformat() if record.started_at else None,
        "finished_at": record.finished_at.isoformat() if record.finished_at else None,
        "result_data": record.result_data,
        "download_url": None,
        "error_message": record.error_message,
    }
