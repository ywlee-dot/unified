"""
테스트1 서비스 (n8n 연동)
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.services.n8n_client import N8nClient, get_webhook_base


class Test1Service:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.n8n = N8nClient(
            webhook_base=get_webhook_base(1),
        )

    async def get_runs(self) -> list[dict]:
        return []

    async def trigger_workflow(self, workflow_id: str, parameters: dict) -> dict:
        run_id = str(uuid.uuid4())
        # TODO: 실제 n8n 웹훅 호출로 교체
        # await self.n8n.trigger_webhook(f"/webhook/test1", parameters)
        return {
            "run_id": run_id,
            "status": "triggered",
            "message": f"워크플로우 '{workflow_id}' 실행이 요청되었습니다.",
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        }
