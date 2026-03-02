"""SQLAlchemy models for Content Manager project."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class ContentCategoryModel(BaseEntity):
    __tablename__ = "content_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    parent_id: Mapped[str | None] = mapped_column(
        ForeignKey("content_categories.id"), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class ContentModel(BaseEntity):
    __tablename__ = "contents"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[str | None] = mapped_column(
        ForeignKey("content_categories.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="draft")
    author: Mapped[str] = mapped_column(String(100), nullable=False)
    tags: Mapped[list | None] = mapped_column(JSONB, default=[])
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, default={})
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
