"""Dummy data for Notifications project."""

import random
from datetime import datetime, timedelta, timezone

from app.projects.notifications.schemas import (
    NotificationChannel,
    NotificationHistory,
    NotificationStats,
    NotificationTemplate,
)

_now = datetime.now(timezone.utc)

NOTIFICATION_TEMPLATES: list[NotificationTemplate] = [
    NotificationTemplate(
        id="tmpl-001", name="가입 환영", channel="email",
        subject="환영합니다!",
        body_template="안녕하세요 {{name}}님, 가입을 환영합니다.",
        variables=["name"], created_at=_now - timedelta(days=90),
    ),
    NotificationTemplate(
        id="tmpl-002", name="비밀번호 재설정", channel="email",
        subject="비밀번호 재설정 안내",
        body_template="{{name}}님, 비밀번호 재설정 링크: {{link}}",
        variables=["name", "link"], created_at=_now - timedelta(days=85),
    ),
    NotificationTemplate(
        id="tmpl-003", name="주문 알림", channel="sms",
        subject=None,
        body_template="[알림] {{item}} 주문이 완료되었습니다. 주문번호: {{order_id}}",
        variables=["item", "order_id"], created_at=_now - timedelta(days=60),
    ),
    NotificationTemplate(
        id="tmpl-004", name="시스템 장애 알림", channel="slack",
        subject=None,
        body_template="[장애] {{service}} 서비스에서 오류 발생. 상세: {{detail}}",
        variables=["service", "detail"], created_at=_now - timedelta(days=45),
    ),
    NotificationTemplate(
        id="tmpl-005", name="일간 리포트 알림", channel="webhook",
        subject=None,
        body_template='{"type": "daily_report", "date": "{{date}}", "summary": "{{summary}}"}',
        variables=["date", "summary"], created_at=_now - timedelta(days=30),
    ),
    NotificationTemplate(
        id="tmpl-006", name="배포 완료 알림", channel="slack",
        subject=None,
        body_template="[배포] {{project}} v{{version}} 배포가 완료되었습니다.",
        variables=["project", "version"], created_at=_now - timedelta(days=15),
    ),
]

NOTIFICATION_CHANNELS: list[NotificationChannel] = [
    NotificationChannel(
        id="ch-001", channel_type="email",
        config={"smtp_host": "smtp.example.com", "smtp_port": 587, "from_email": "noreply@example.com"},
        is_enabled=True, updated_at=_now - timedelta(days=30),
    ),
    NotificationChannel(
        id="ch-002", channel_type="sms",
        config={"provider": "twilio", "from_number": "+821012345678"},
        is_enabled=True, updated_at=_now - timedelta(days=25),
    ),
    NotificationChannel(
        id="ch-003", channel_type="slack",
        config={"webhook_url": "https://hooks.slack.com/services/EXAMPLE"},
        is_enabled=True, updated_at=_now - timedelta(days=20),
    ),
    NotificationChannel(
        id="ch-004", channel_type="webhook",
        config={"default_method": "POST", "timeout_seconds": 30},
        is_enabled=False, updated_at=_now - timedelta(days=10),
    ),
]


def _generate_notification_history(count: int = 50) -> list[NotificationHistory]:
    """Generate dummy notification history entries."""
    channels = ["email", "sms", "slack", "webhook"]
    statuses = ["sent", "delivered", "delivered", "delivered", "failed", "pending"]
    template_names = [t.name for t in NOTIFICATION_TEMPLATES]
    recipients_pool = [
        "user@example.com", "admin@example.com", "+821098765432",
        "#alerts", "#deploy", "https://webhook.example.com/notify",
        "dev@example.com", "manager@example.com", "+821011112222",
        "#general",
    ]
    histories = []
    for i in range(count):
        channel = random.choice(channels)
        status = random.choice(statuses)
        error = "SMTP 연결 실패" if status == "failed" and channel == "email" else (
            "수신자 번호 오류" if status == "failed" and channel == "sms" else None
        )
        histories.append(
            NotificationHistory(
                id=f"notif-{i+1:03d}",
                template_name=random.choice(template_names),
                channel=channel,
                recipient=random.choice(recipients_pool),
                status=status,
                sent_at=_now - timedelta(hours=random.randint(1, 720)),
                error_message=error,
            )
        )
    histories.sort(key=lambda h: h.sent_at, reverse=True)
    return histories


_CACHED_HISTORY: list[NotificationHistory] | None = None


def get_dummy_templates() -> list[NotificationTemplate]:
    return NOTIFICATION_TEMPLATES


def get_dummy_channels() -> list[NotificationChannel]:
    return NOTIFICATION_CHANNELS


def get_dummy_history() -> list[NotificationHistory]:
    global _CACHED_HISTORY
    if _CACHED_HISTORY is None:
        _CACHED_HISTORY = _generate_notification_history(50)
    return _CACHED_HISTORY


def get_dummy_stats() -> NotificationStats:
    history = get_dummy_history()
    total = len(history)
    delivered = sum(1 for h in history if h.status == "delivered")
    failed = sum(1 for h in history if h.status == "failed")
    by_channel: dict[str, int] = {}
    for h in history:
        by_channel[h.channel] = by_channel.get(h.channel, 0) + 1
    return NotificationStats(
        total_sent=total,
        delivered=delivered,
        failed=failed,
        delivery_rate=round(delivered / total * 100, 1) if total > 0 else 0.0,
        by_channel=by_channel,
    )
