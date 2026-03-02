"""Pydantic schemas for Notifications project."""

from datetime import datetime

from pydantic import BaseModel


class NotificationTemplate(BaseModel):
    id: str
    name: str
    channel: str  # "email" | "sms" | "webhook" | "slack"
    subject: str | None = None
    body_template: str
    variables: list[str]
    created_at: datetime


class NotificationTemplateCreate(BaseModel):
    name: str
    channel: str
    subject: str | None = None
    body_template: str
    variables: list[str] = []


class NotificationSend(BaseModel):
    template_id: str
    channel: str
    recipients: list[str]
    variables: dict[str, str] = {}


class NotificationHistory(BaseModel):
    id: str
    template_name: str
    channel: str
    recipient: str
    status: str  # "sent" | "delivered" | "failed" | "pending"
    sent_at: datetime
    error_message: str | None = None


class NotificationChannel(BaseModel):
    id: str
    channel_type: str
    config: dict
    is_enabled: bool
    updated_at: datetime


class NotificationStats(BaseModel):
    total_sent: int
    delivered: int
    failed: int
    delivery_rate: float
    by_channel: dict[str, int]
