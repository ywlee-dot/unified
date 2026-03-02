"""Business logic service for Notifications project."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.projects.notifications.dummy_data import (
    get_dummy_channels,
    get_dummy_history,
    get_dummy_stats,
    get_dummy_templates,
)
from app.projects.notifications.schemas import (
    NotificationChannel,
    NotificationHistory,
    NotificationSend,
    NotificationStats,
    NotificationTemplate,
    NotificationTemplateCreate,
)


class NotificationService:
    """Service returning dummy data for scaffold."""

    async def get_templates(self) -> list[NotificationTemplate]:
        return get_dummy_templates()

    async def get_template(self, template_id: str) -> NotificationTemplate | None:
        for t in get_dummy_templates():
            if t.id == template_id:
                return t
        return None

    async def create_template(self, data: NotificationTemplateCreate) -> NotificationTemplate:
        return NotificationTemplate(
            id=str(uuid.uuid4()),
            name=data.name,
            channel=data.channel,
            subject=data.subject,
            body_template=data.body_template,
            variables=data.variables,
            created_at=datetime.now(timezone.utc),
        )

    async def update_template(
        self, template_id: str, data: NotificationTemplateCreate
    ) -> NotificationTemplate | None:
        template = await self.get_template(template_id)
        if not template:
            return None
        return NotificationTemplate(
            id=template.id,
            name=data.name,
            channel=data.channel,
            subject=data.subject,
            body_template=data.body_template,
            variables=data.variables,
            created_at=template.created_at,
        )

    async def delete_template(self, template_id: str) -> bool:
        template = await self.get_template(template_id)
        return template is not None

    async def send_notification(self, data: NotificationSend) -> dict:
        return {
            "success": True,
            "message": f"{len(data.recipients)}명에게 알림이 발송되었습니다",
            "channel": data.channel,
            "recipients_count": len(data.recipients),
        }

    async def get_history(self, page: int = 1, page_size: int = 20) -> dict:
        history = get_dummy_history()
        total = len(history)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": history[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    async def get_channels(self) -> list[NotificationChannel]:
        return get_dummy_channels()

    async def update_channel(self, channel_id: str, is_enabled: bool) -> NotificationChannel | None:
        for ch in get_dummy_channels():
            if ch.id == channel_id:
                return NotificationChannel(
                    id=ch.id,
                    channel_type=ch.channel_type,
                    config=ch.config,
                    is_enabled=is_enabled,
                    updated_at=datetime.now(timezone.utc),
                )
        return None

    async def get_stats(self) -> NotificationStats:
        return get_dummy_stats()
