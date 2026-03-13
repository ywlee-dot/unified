"""
업무규칙 자동 생성 더미 데이터
"""
from datetime import datetime, timezone


def get_dummy_runs() -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "run_id": "run-001",
            "workflow_id": "business-rule-gen-main",
            "workflow_name": "업무규칙 자동 생성 실행",
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
            "id": "business-rule-gen-main",
            "name": "업무규칙 자동 생성 실행",
            "description": "업무규칙 자동 생성 워크플로우",
            "trigger_type": "manual",
            "status": "active",
            "last_run_at": None,
        },
    ]
