"""n8n webhook client for triggering workflows."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone


class N8nTriggerResponse:
    """Response from triggering an n8n webhook."""

    def __init__(self, run_id: str, status: str, message: str):
        self.run_id = run_id
        self.status = status
        self.message = message


class N8nClient:
    """n8n webhook client - mock implementation for scaffold."""

    def __init__(
        self,
        base_url: str = "http://n8n:5678",
        webhook_base: str = "http://n8n:5678/webhook",
        api_key: str | None = None,
        basic_auth: tuple[str, str] | None = None,
        timeout: float = 30.0,
    ):
        self.base_url = base_url
        self.webhook_base = webhook_base
        self.api_key = api_key
        self.basic_auth = basic_auth
        self.timeout = timeout

    async def trigger_webhook(
        self,
        webhook_path: str,
        payload: dict | None = None,
    ) -> N8nTriggerResponse:
        """Trigger an n8n workflow via webhook (mock)."""
        run_id = str(uuid.uuid4())
        return N8nTriggerResponse(
            run_id=run_id,
            status="triggered",
            message=f"Workflow triggered via {webhook_path}",
        )

    async def get_execution_status(self, execution_id: str) -> dict:
        """Get execution status (mock)."""
        return {
            "run_id": execution_id,
            "status": "completed",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }

    async def get_execution_result(self, execution_id: str) -> dict:
        """Get execution result data (mock)."""
        return {
            "run_id": execution_id,
            "result_data": {"message": "Mock execution result"},
        }
