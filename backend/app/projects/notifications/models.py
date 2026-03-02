"""SQLAlchemy models for Notifications project."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class NotificationTemplateModel(BaseEntity):
    __tablename__ = "notification_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(500))
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list | None] = mapped_column(JSONB, default=[])
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class NotificationHistoryModel(BaseEntity):
    __tablename__ = "notification_history"

    template_id: Mapped[str | None] = mapped_column(String(36))
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(500))
    body: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class NotificationChannelModel(BaseEntity):
    __tablename__ = "notification_channels"

    channel_type: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    config: Mapped[dict | None] = mapped_column(JSONB, default={})
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
