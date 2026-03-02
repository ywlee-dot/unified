"""SQLAlchemy models for Data Collector project."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class CollectorJobModel(BaseEntity):
    __tablename__ = "collector_jobs"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    schedule: Mapped[str | None] = mapped_column(String(100))
    config: Mapped[dict | None] = mapped_column(JSONB, default={})
    status: Mapped[str] = mapped_column(String(20), default="active")
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_collected: Mapped[int] = mapped_column(Integer, default=0)


class CollectionHistoryModel(BaseEntity):
    __tablename__ = "collection_history"

    job_id: Mapped[str] = mapped_column(
        ForeignKey("collector_jobs.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    items_collected: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
