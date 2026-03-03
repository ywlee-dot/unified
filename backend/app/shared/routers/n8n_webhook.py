"""Callback endpoint for n8n workflow completion notifications."""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
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
