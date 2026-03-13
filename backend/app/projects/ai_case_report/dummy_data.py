"""
AI 도입활용 사례 정성보고서 작성 더미 데이터
"""
from datetime import datetime, timezone


def get_dummy_runs() -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "run_id": "run-001",
            "workflow_id": "ai-case-report-main",
            "workflow_name": "AI 도입활용 사례 정성보고서 작성 실행",
            "status": "completed",
            "started_at": now.isoformat(),
            "finished_at": now.isoformat(),
            "result_data": {"processed": 100},
            "error_message": None,
        },
    ]


def get_dummy_workflows() -> list[dict]:
    return [
        {
            "id": "ai-case-report-main",
            "name": "AI 도입활용 사례 정성보고서 작성 실행",
            "description": "AI 도입활용 사례 정성보고서 작성 워크플로우",
            "trigger_type": "manual",
            "status": "active",
            "last_run_at": None,
        },
    ]
