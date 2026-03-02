"""Dummy data for Data Pipeline project (n8n)."""

from datetime import datetime, timedelta, timezone

from app.projects.data_pipeline.schemas import Pipeline, PipelineRun

_now = datetime.now(timezone.utc)

PIPELINES: list[Pipeline] = [
    Pipeline(
        id="etl-daily", name="일간 ETL 파이프라인",
        description="매일 새벽 2시 전일 데이터를 수집/변환/적재합니다",
        source="external_db", destination="data_warehouse",
        schedule="0 2 * * *", status="active", last_run_at=_now - timedelta(hours=6),
    ),
    Pipeline(
        id="sync-external", name="외부 DB 동기화",
        description="외부 데이터베이스의 변경사항을 동기화합니다",
        source="partner_api", destination="internal_db",
        schedule="0 3 * * *", status="active", last_run_at=_now - timedelta(hours=5),
    ),
    Pipeline(
        id="data-cleanup", name="데이터 정리",
        description="오래된 임시 데이터와 로그를 정리합니다",
        source="all_databases", destination="archive",
        schedule=None, status="active", last_run_at=_now - timedelta(days=7),
    ),
]

PIPELINE_RUNS: list[PipelineRun] = [
    PipelineRun(
        run_id="run-p-001", pipeline_id="etl-daily", pipeline_name="일간 ETL 파이프라인",
        status="completed", started_at=_now - timedelta(hours=6),
        finished_at=_now - timedelta(hours=6) + timedelta(minutes=3),
        records_processed=15420, records_failed=3,
        logs=["[INFO] ETL 파이프라인 시작", "[INFO] 소스 데이터 추출 완료: 15423건", "[WARN] 3건 변환 실패 (데이터 형식 오류)", "[INFO] 15420건 적재 완료", "[INFO] ETL 파이프라인 완료 (소요시간: 180초)"],
    ),
    PipelineRun(
        run_id="run-p-002", pipeline_id="sync-external", pipeline_name="외부 DB 동기화",
        status="completed", started_at=_now - timedelta(hours=5),
        finished_at=_now - timedelta(hours=5) + timedelta(minutes=1, seconds=35),
        records_processed=8200, records_failed=0,
        logs=["[INFO] 외부 DB 동기화 시작", "[INFO] 변경사항 감지: 8200건", "[INFO] 동기화 완료 (소요시간: 95초)"],
    ),
    PipelineRun(
        run_id="run-p-003", pipeline_id="etl-daily", pipeline_name="일간 ETL 파이프라인",
        status="running", started_at=_now - timedelta(minutes=5),
        records_processed=0, records_failed=0,
        logs=["[INFO] ETL 파이프라인 시작", "[INFO] 소스 데이터 추출 중..."],
    ),
    PipelineRun(
        run_id="run-p-004", pipeline_id="etl-daily", pipeline_name="일간 ETL 파이프라인",
        status="completed", started_at=_now - timedelta(days=1, hours=6),
        finished_at=_now - timedelta(days=1, hours=6) + timedelta(minutes=3, seconds=15),
        records_processed=14800, records_failed=1,
        logs=["[INFO] ETL 파이프라인 시작", "[INFO] 14801건 추출", "[WARN] 1건 실패", "[INFO] 14800건 적재 완료"],
    ),
    PipelineRun(
        run_id="run-p-005", pipeline_id="sync-external", pipeline_name="외부 DB 동기화",
        status="failed", started_at=_now - timedelta(days=1, hours=5),
        finished_at=_now - timedelta(days=1, hours=5) + timedelta(seconds=30),
        records_processed=0, records_failed=0,
        error_message="외부 DB 연결 실패: Connection refused",
        logs=["[INFO] 외부 DB 동기화 시작", "[ERROR] 연결 실패: Connection refused", "[ERROR] 파이프라인 중단"],
    ),
    PipelineRun(
        run_id="run-p-006", pipeline_id="data-cleanup", pipeline_name="데이터 정리",
        status="completed", started_at=_now - timedelta(days=7),
        finished_at=_now - timedelta(days=7) + timedelta(minutes=10),
        records_processed=52000, records_failed=0,
        logs=["[INFO] 데이터 정리 시작", "[INFO] 30일 이전 로그 삭제: 35000건", "[INFO] 임시 파일 정리: 17000건", "[INFO] 정리 완료"],
    ),
    PipelineRun(
        run_id="run-p-007", pipeline_id="etl-daily", pipeline_name="일간 ETL 파이프라인",
        status="completed", started_at=_now - timedelta(days=2, hours=6),
        finished_at=_now - timedelta(days=2, hours=6) + timedelta(minutes=2, seconds=50),
        records_processed=13500, records_failed=5,
    ),
    PipelineRun(
        run_id="run-p-008", pipeline_id="sync-external", pipeline_name="외부 DB 동기화",
        status="completed", started_at=_now - timedelta(days=2, hours=5),
        finished_at=_now - timedelta(days=2, hours=5) + timedelta(minutes=1, seconds=20),
        records_processed=7800, records_failed=0,
    ),
    PipelineRun(
        run_id="run-p-009", pipeline_id="etl-daily", pipeline_name="일간 ETL 파이프라인",
        status="completed", started_at=_now - timedelta(days=3, hours=6),
        finished_at=_now - timedelta(days=3, hours=6) + timedelta(minutes=3, seconds=5),
        records_processed=16200, records_failed=2,
    ),
    PipelineRun(
        run_id="run-p-010", pipeline_id="etl-daily", pipeline_name="일간 ETL 파이프라인",
        status="failed", started_at=_now - timedelta(days=4, hours=6),
        finished_at=_now - timedelta(days=4, hours=6) + timedelta(minutes=1),
        records_processed=5000, records_failed=200,
        error_message="디스크 공간 부족으로 적재 실패",
    ),
]


def get_dummy_pipelines() -> list[Pipeline]:
    return PIPELINES


def get_dummy_runs() -> list[PipelineRun]:
    return PIPELINE_RUNS
