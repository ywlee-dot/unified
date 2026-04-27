"""SQLAlchemy model for unified process execution records.

This is the canonical execution record used by both n8n-driven workflows and
in-process services. Each row captures a single run: who, what input, the
result snapshot used for re-export, and lifecycle metadata.
"""

from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class ProcessExecutionModel(BaseEntity):
    __tablename__ = "process_executions"

    execution_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    project_slug: Mapped[str] = mapped_column(String(100))
    process_type: Mapped[str] = mapped_column(String(50), default="inprocess")

    input_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    input_summary: Mapped[str] = mapped_column(String(500), default="")

    status: Mapped[str] = mapped_column(String(50), default="running")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    result_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    workflow_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    workflow_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    callback_received: Mapped[bool] = mapped_column(default=False)

    __table_args__ = (
        Index("ix_process_executions_project_status", "project_slug", "status"),
        Index("ix_process_executions_project_started", "project_slug", "started_at"),
    )


N8nExecutionModel = ProcessExecutionModel
