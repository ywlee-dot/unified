"""Callback endpoint for n8n workflow completion notifications."""

from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.shared.models.n8n_execution import N8nExecutionModel

logger = logging.getLogger(__name__)

router = APIRouter()


class N8nCallbackRequest(BaseModel):
    execution_id: str
    status: str  # "completed" | "failed"
    result_data: dict | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


def _upload_dir(tracking_id: str) -> Path:
    return Path(settings.UPLOAD_DIR) / tracking_id


@router.post("/upload/{tracking_id}")
async def upload_result_file(
    tracking_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    x_n8n_callback_secret: str | None = Header(default=None),
):
    """n8n 워크플로우 결과 파일 업로드 (범용)."""
    if x_n8n_callback_secret != settings.N8N_CALLBACK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid callback secret")

    stmt = select(N8nExecutionModel).where(
        N8nExecutionModel.execution_id == tracking_id
    )
    result = await db.execute(stmt)
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    dest_dir = _upload_dir(tracking_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    filename = file.filename or "result"
    dest_path = dest_dir / filename

    content = await file.read()
    dest_path.write_bytes(content)

    download_url = f"/api/webhooks/n8n/download/{tracking_id}/{filename}"

    logger.info("File uploaded: tracking_id=%s file=%s size=%d", tracking_id, filename, len(content))
    return {"download_url": download_url, "filename": filename, "size": len(content)}


@router.get("/download/{tracking_id}/{filename}")
async def download_result_file(
    tracking_id: str,
    filename: str,
):
    """결과 파일 다운로드 (범용)."""
    file_path = _upload_dir(tracking_id) / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # 경로 탈출 방지
    try:
        file_path.resolve().relative_to(Path(settings.UPLOAD_DIR).resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream",
    )


@router.post("/callback")
async def n8n_callback(
    body: N8nCallbackRequest,
    db: AsyncSession = Depends(get_db),
    x_n8n_callback_secret: str | None = Header(default=None),
):
    """Receive completion callback from n8n workflows."""
    if x_n8n_callback_secret != settings.N8N_CALLBACK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid callback secret")

    stmt = select(N8nExecutionModel).where(
        N8nExecutionModel.execution_id == body.execution_id
    )
    result = await db.execute(stmt)
    execution = result.scalar_one_or_none()

    if not execution:
        logger.warning("Callback for unknown execution_id: %s", body.execution_id)
        raise HTTPException(status_code=404, detail="Execution not found")

    execution.status = body.status
    execution.callback_received = True
    execution.result_data = body.result_data
    execution.error_message = body.error_message
    if body.finished_at:
        execution.finished_at = body.finished_at
    else:
        from sqlalchemy import func
        execution.finished_at = func.now()
    if body.started_at and execution.started_at is None:
        execution.started_at = body.started_at

    await db.commit()
    logger.info(
        "n8n callback received: execution_id=%s status=%s",
        body.execution_id,
        body.status,
    )
    return {"status": "ok", "execution_id": body.execution_id}
