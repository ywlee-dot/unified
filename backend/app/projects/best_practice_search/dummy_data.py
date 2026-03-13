"""
민간 활용 우수사례 검색 서비스 더미 데이터
"""
from datetime import datetime, timezone


def get_dummy_runs() -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "run_id": "run-001",
            "workflow_id": "best-practice-search-main",
            "workflow_name": "민간 활용 우수사례 검색 서비스 실행",
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
            "id": "best-practice-search-main",
            "name": "민간 활용 우수사례 검색 서비스 실행",
            "description": "민간 활용 우수사례 검색 서비스 워크플로우",
            "trigger_type": "manual",
            "status": "active",
            "last_run_at": None,
        },
    ]
