"""Unified execution record persistence for all project services.

Every long-running analysis or workflow lifecycle (create → run → succeeded/failed)
goes through this recorder so the result is durably saved and re-exportable later
without re-running the analysis.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.process_execution import ProcessExecutionModel


class ExecutionRecorder:
    """Standardized lifecycle helper for ``process_executions`` rows."""

    @staticmethod
    async def create(
        db: AsyncSession,
        *,
        project_slug: str,
        process_type: str = "inprocess",
        input_metadata: dict[str, Any] | None = None,
        input_summary: str = "",
        execution_id: str | None = None,
        workflow_id: str | None = None,
        workflow_name: str | None = None,
    ) -> ProcessExecutionModel:
        record = ProcessExecutionModel(
            id=str(uuid.uuid4()),
            execution_id=execution_id or uuid.uuid4().hex,
            project_slug=project_slug,
            process_type=process_type,
            input_metadata=input_metadata,
            input_summary=input_summary[:500],
            status="running",
            started_at=datetime.now(timezone.utc),
            workflow_id=workflow_id,
            workflow_name=workflow_name,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record

    @staticmethod
    async def mark_succeeded(
        db: AsyncSession,
        *,
        execution_id: str,
        result_data: dict[str, Any],
    ) -> ProcessExecutionModel | None:
        record = await ExecutionRecorder.get(db, execution_id)
        if record is None:
            return None
        record.status = "succeeded"
        record.result_data = result_data
        record.finished_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(record)
        return record

    @staticmethod
    async def mark_failed(
        db: AsyncSession,
        *,
        execution_id: str,
        error_message: str,
    ) -> ProcessExecutionModel | None:
        record = await ExecutionRecorder.get(db, execution_id)
        if record is None:
            return None
        record.status = "failed"
        record.error_message = error_message[:5000]
        record.finished_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(record)
        return record

    @staticmethod
    async def get(
        db: AsyncSession,
        execution_id: str,
    ) -> ProcessExecutionModel | None:
        stmt = select(ProcessExecutionModel).where(
            ProcessExecutionModel.execution_id == execution_id
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list(
        db: AsyncSession,
        *,
        project_slug: str,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> dict[str, Any]:
        page = max(1, page)
        page_size = max(1, min(page_size, 100))

        filters = [ProcessExecutionModel.project_slug == project_slug]
        if status:
            filters.append(ProcessExecutionModel.status == status)

        count_stmt = (
            select(sa_func.count())
            .select_from(ProcessExecutionModel)
            .where(*filters)
        )
        total = (await db.execute(count_stmt)).scalar() or 0

        offset = (page - 1) * page_size
        stmt = (
            select(ProcessExecutionModel)
            .where(*filters)
            .order_by(ProcessExecutionModel.started_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        items = list((await db.execute(stmt)).scalars().all())

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        }

    @staticmethod
    async def delete(
        db: AsyncSession,
        execution_id: str,
    ) -> bool:
        stmt = delete(ProcessExecutionModel).where(
            ProcessExecutionModel.execution_id == execution_id
        )
        result = await db.execute(stmt)
        await db.commit()
        return (result.rowcount or 0) > 0


def serialize_execution(
    record: ProcessExecutionModel,
    *,
    include_result: bool = False,
) -> dict[str, Any]:
    """Convert an execution record to a JSON-friendly dict.

    Result data is large; omit it from list responses to keep payloads small.
    """
    payload: dict[str, Any] = {
        "execution_id": record.execution_id,
        "project_slug": record.project_slug,
        "process_type": record.process_type,
        "status": record.status,
        "input_summary": record.input_summary,
        "input_metadata": record.input_metadata,
        "started_at": record.started_at.isoformat() if record.started_at else None,
        "finished_at": record.finished_at.isoformat() if record.finished_at else None,
        "error_message": record.error_message,
        "workflow_id": record.workflow_id,
        "workflow_name": record.workflow_name,
    }
    if include_result:
        payload["result_data"] = record.result_data
    return payload
