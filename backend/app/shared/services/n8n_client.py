"""n8n webhook client for triggering workflows."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.n8n_execution import N8nExecutionModel

logger = logging.getLogger(__name__)


def get_webhook_base(n8n_account: int = 1) -> str:
    """Return the webhook base URL for a given n8n account number (1-3)."""
    from app.config import settings

    mapping = {
        1: settings.N8N_WEBHOOK_BASE_1,
        2: settings.N8N_WEBHOOK_BASE_2,
        3: settings.N8N_WEBHOOK_BASE_3,
    }
    base = mapping.get(n8n_account, "")
    if not base:
        raise ValueError(f"n8n account {n8n_account}에 대한 webhook URL이 설정되지 않았습니다.")
    return base.rstrip("/")


class N8nTriggerResponse:
    """Response from triggering an n8n webhook."""

    def __init__(self, run_id: str, status: str, message: str):
        self.run_id = run_id
        self.status = status
        self.message = message


class N8nClient:
    """n8n webhook client (trigger only — status is read from DB via callbacks)."""

    def __init__(
        self,
        webhook_base: str = "http://n8n:5678/webhook",
        timeout: float = 30.0,
        **_kwargs,
    ):
        self.webhook_base = webhook_base.rstrip("/")
        self.timeout = timeout

    async def trigger_webhook(
        self,
        webhook_path: str,
        payload: dict | None = None,
    ) -> N8nTriggerResponse:
        """Trigger an n8n workflow via webhook."""
        url = f"{self.webhook_base}{webhook_path}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                resp = await client.post(url, json=payload or {})
                resp.raise_for_status()
                data = resp.json()
                execution_id = (
                    data.get("executionId")
                    or data.get("execution_id")
                    or str(data.get("id", ""))
                )
                return N8nTriggerResponse(
                    run_id=execution_id,
                    status="triggered",
                    message=f"Workflow triggered via {webhook_path}",
                )
            except httpx.HTTPStatusError as e:
                logger.error("n8n webhook error: %s %s", e.response.status_code, e.response.text)
                return N8nTriggerResponse(
                    run_id="",
                    status="failed",
                    message=f"n8n webhook 호출 실패: {e.response.status_code}",
                )
            except httpx.RequestError as e:
                logger.error("n8n webhook request error: %s", e)
                return N8nTriggerResponse(
                    run_id="",
                    status="failed",
                    message=f"n8n 연결 실패: {e}",
                )


async def create_execution_record(
    db: AsyncSession,
    *,
    execution_id: str,
    project_slug: str,
    workflow_id: str,
    workflow_name: str = "",
    input_metadata: dict | None = None,
    input_summary: str = "",
) -> N8nExecutionModel:
    """Create a 'running' execution record in DB after triggering a webhook."""
    record = N8nExecutionModel(
        id=str(uuid.uuid4()),
        execution_id=execution_id,
        project_slug=project_slug,
        process_type="n8n",
        input_metadata=input_metadata,
        input_summary=input_summary[:500] if input_summary else "",
        workflow_id=workflow_id,
        workflow_name=workflow_name,
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_execution(db: AsyncSession, execution_id: str) -> N8nExecutionModel | None:
    """Get a single execution record by execution_id."""
    stmt = select(N8nExecutionModel).where(
        N8nExecutionModel.execution_id == execution_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_executions_from_db(
    db: AsyncSession,
    project_slug: str,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """List execution records from DB for a given project slug with pagination."""
    count_stmt = (
        select(sa_func.count())
        .select_from(N8nExecutionModel)
        .where(N8nExecutionModel.project_slug == project_slug)
    )
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    stmt = (
        select(N8nExecutionModel)
        .where(N8nExecutionModel.project_slug == project_slug)
        .order_by(N8nExecutionModel.started_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    items = list(result.scalars().all())

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }
