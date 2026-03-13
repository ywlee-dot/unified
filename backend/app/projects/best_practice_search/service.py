"""
민간 활용 우수사례 검색 서비스 서비스 (n8n 연동)
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.services.n8n_client import N8nClient
from app.config import settings
from .dummy_data import get_dummy_runs


class Best_practice_searchService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.n8n = N8nClient(
            base_url=settings.N8N_BASE_URL,
            webhook_base=settings.N8N_WEBHOOK_BASE,
        )

    async def get_runs(self) -> list[dict]:
        return get_dummy_runs()

    async def trigger_workflow(self, workflow_id: str, parameters: dict) -> dict:
        run_id = str(uuid.uuid4())
        # TODO: 실제 n8n 웹훅 호출로 교체
        # await self.n8n.trigger_webhook(f"/webhook/best-practice-search", parameters)
        return {
            "run_id": run_id,
            "status": "triggered",
            "message": f"워크플로우 '{workflow_id}' 실행이 요청되었습니다.",
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        }
