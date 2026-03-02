"""Dummy data for Report Generator project (n8n)."""

from datetime import datetime, timedelta, timezone

from app.projects.report_generator.schemas import N8nRunResult, N8nWorkflow

_now = datetime.now(timezone.utc)

REPORT_WORKFLOWS: list[N8nWorkflow] = [
    N8nWorkflow(
        id="generate-daily", name="일간 리포트 생성",
        description="매일 오전 9시 일간 데이터 리포트를 자동 생성합니다",
        trigger_type="manual", last_run_at=_now - timedelta(hours=3), status="active",
    ),
    N8nWorkflow(
        id="generate-weekly", name="주간 리포트 생성",
        description="매주 월요일 오전 9시 주간 종합 리포트를 생성합니다",
        trigger_type="manual", last_run_at=_now - timedelta(days=5), status="active",
    ),
]

REPORT_RUNS: list[N8nRunResult] = [
    N8nRunResult(run_id="run-r-001", workflow_id="generate-daily", workflow_name="일간 리포트 생성", status="completed", result_data={"report_url": "/reports/daily-2026-03-01.pdf", "pages": 5, "charts": 8}, started_at=_now - timedelta(hours=3), finished_at=_now - timedelta(hours=3) + timedelta(minutes=2, seconds=30), download_url="/api/projects/report-generator/runs/run-r-001/download"),
    N8nRunResult(run_id="run-r-002", workflow_id="generate-weekly", workflow_name="주간 리포트 생성", status="completed", result_data={"report_url": "/reports/weekly-2026-w09.pdf", "pages": 12, "charts": 15}, started_at=_now - timedelta(days=5), finished_at=_now - timedelta(days=5) + timedelta(minutes=5), download_url="/api/projects/report-generator/runs/run-r-002/download"),
    N8nRunResult(run_id="run-r-003", workflow_id="generate-daily", workflow_name="일간 리포트 생성", status="failed", error_message="데이터 소스 연결 타임아웃", started_at=_now - timedelta(days=2), finished_at=_now - timedelta(days=2) + timedelta(minutes=1)),
    N8nRunResult(run_id="run-r-004", workflow_id="generate-daily", workflow_name="일간 리포트 생성", status="completed", result_data={"report_url": "/reports/daily-2026-02-27.pdf", "pages": 5, "charts": 7}, started_at=_now - timedelta(days=3), finished_at=_now - timedelta(days=3) + timedelta(minutes=2, seconds=15), download_url="/api/projects/report-generator/runs/run-r-004/download"),
    N8nRunResult(run_id="run-r-005", workflow_id="generate-daily", workflow_name="일간 리포트 생성", status="completed", result_data={"report_url": "/reports/daily-2026-02-26.pdf", "pages": 4, "charts": 6}, started_at=_now - timedelta(days=4), finished_at=_now - timedelta(days=4) + timedelta(minutes=2), download_url="/api/projects/report-generator/runs/run-r-005/download"),
    N8nRunResult(run_id="run-r-006", workflow_id="generate-weekly", workflow_name="주간 리포트 생성", status="completed", result_data={"report_url": "/reports/weekly-2026-w08.pdf", "pages": 11, "charts": 14}, started_at=_now - timedelta(days=12), finished_at=_now - timedelta(days=12) + timedelta(minutes=4, seconds=45), download_url="/api/projects/report-generator/runs/run-r-006/download"),
    N8nRunResult(run_id="run-r-007", workflow_id="generate-daily", workflow_name="일간 리포트 생성", status="completed", result_data={"report_url": "/reports/daily-2026-02-25.pdf", "pages": 5, "charts": 8}, started_at=_now - timedelta(days=5), finished_at=_now - timedelta(days=5) + timedelta(minutes=2, seconds=10)),
    N8nRunResult(run_id="run-r-008", workflow_id="generate-daily", workflow_name="일간 리포트 생성", status="failed", error_message="메모리 부족으로 리포트 생성 실패", started_at=_now - timedelta(days=6), finished_at=_now - timedelta(days=6) + timedelta(seconds=45)),
    N8nRunResult(run_id="run-r-009", workflow_id="generate-daily", workflow_name="일간 리포트 생성", status="completed", result_data={"report_url": "/reports/daily-2026-02-23.pdf", "pages": 5, "charts": 7}, started_at=_now - timedelta(days=7), finished_at=_now - timedelta(days=7) + timedelta(minutes=2, seconds=20)),
    N8nRunResult(run_id="run-r-010", workflow_id="generate-weekly", workflow_name="주간 리포트 생성", status="completed", result_data={"report_url": "/reports/weekly-2026-w07.pdf", "pages": 10, "charts": 12}, started_at=_now - timedelta(days=19), finished_at=_now - timedelta(days=19) + timedelta(minutes=4, seconds=30)),
    N8nRunResult(run_id="run-r-011", workflow_id="generate-daily", workflow_name="일간 리포트 생성", status="completed", result_data={"report_url": "/reports/daily-2026-02-22.pdf", "pages": 6, "charts": 9}, started_at=_now - timedelta(days=8), finished_at=_now - timedelta(days=8) + timedelta(minutes=3)),
    N8nRunResult(run_id="run-r-012", workflow_id="generate-daily", workflow_name="일간 리포트 생성", status="completed", result_data={"report_url": "/reports/daily-2026-02-21.pdf", "pages": 5, "charts": 8}, started_at=_now - timedelta(days=9), finished_at=_now - timedelta(days=9) + timedelta(minutes=2, seconds=40)),
]


def get_dummy_workflows() -> list[N8nWorkflow]:
    return REPORT_WORKFLOWS


def get_dummy_runs() -> list[N8nRunResult]:
    return REPORT_RUNS
