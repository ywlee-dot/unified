"""SQLAlchemy model for n8n execution records."""

from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class N8nExecutionModel(BaseEntity):
    __tablename__ = "n8n_executions"

    execution_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    project_slug: Mapped[str] = mapped_column(String(100))
    workflow_id: Mapped[str] = mapped_column(String(255))
    workflow_name: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(50), default="running")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    result_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    callback_received: Mapped[bool] = mapped_column(default=False)

    __table_args__ = (
        Index("ix_n8n_executions_project_status", "project_slug", "status"),
    )
