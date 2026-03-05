"""
테스트1 더미 데이터
"""
from datetime import datetime, timezone


def get_dummy_runs() -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "run_id": "run-001",
            "workflow_id": "test1-main",
            "workflow_name": "테스트1 실행",
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
            "id": "test1-main",
            "name": "테스트1 실행",
            "description": "테스트1 워크플로우",
            "trigger_type": "manual",
            "status": "active",
            "last_run_at": None,
        },
    ]
