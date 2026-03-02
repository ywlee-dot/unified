"""Dummy data for Data Collector project."""

from datetime import datetime, timedelta, timezone

from app.projects.data_collector.schemas import (
    CollectionHistory,
    CollectorJob,
    CollectorStats,
)

_now = datetime.now(timezone.utc)

COLLECTOR_JOBS: list[CollectorJob] = [
    CollectorJob(id="job-001", name="네이버 뉴스 수집", source_type="web", source_url="https://news.naver.com/rss", schedule="0 */2 * * *", status="active", last_run_at=_now - timedelta(hours=1), collected_count=15420, created_at=_now - timedelta(days=90)),
    CollectorJob(id="job-002", name="공공데이터 API", source_type="api", source_url="https://api.data.go.kr/sample", schedule="0 9 * * *", status="active", last_run_at=_now - timedelta(hours=5), collected_count=8930, created_at=_now - timedelta(days=60)),
    CollectorJob(id="job-003", name="기상청 날씨 데이터", source_type="api", source_url="https://api.weather.go.kr/sample", schedule="0 */6 * * *", status="active", last_run_at=_now - timedelta(hours=3), collected_count=4200, created_at=_now - timedelta(days=45)),
    CollectorJob(id="job-004", name="블로그 RSS 수집", source_type="rss", source_url="https://blog.example.com/feed", schedule="0 8 * * *", status="active", last_run_at=_now - timedelta(hours=8), collected_count=2100, created_at=_now - timedelta(days=30)),
    CollectorJob(id="job-005", name="주가 데이터", source_type="api", source_url="https://api.stock.example.com/v1", schedule="*/5 9-16 * * 1-5", status="active", last_run_at=_now - timedelta(minutes=10), collected_count=52300, created_at=_now - timedelta(days=120)),
    CollectorJob(id="job-006", name="환율 정보", source_type="api", source_url="https://api.exchange.example.com", schedule="0 9 * * *", status="paused", last_run_at=_now - timedelta(days=3), collected_count=1800, created_at=_now - timedelta(days=50)),
    CollectorJob(id="job-007", name="소셜미디어 트렌드", source_type="web", source_url="https://trends.example.com", schedule="0 */4 * * *", status="active", last_run_at=_now - timedelta(hours=2), collected_count=6700, created_at=_now - timedelta(days=25)),
    CollectorJob(id="job-008", name="레거시 시스템 연동", source_type="api", source_url="https://legacy.internal.com/api", schedule="0 2 * * *", status="error", last_run_at=_now - timedelta(days=1), collected_count=900, created_at=_now - timedelta(days=15)),
]


def _generate_history(job_id: str, count: int = 5) -> list[CollectionHistory]:
    """Generate dummy collection history entries for a job."""
    histories = []
    for i in range(count):
        started = _now - timedelta(hours=(i + 1) * 6)
        status = "success" if i < 3 else ("failed" if i == 3 else "success")
        items = 150 + i * 30 if status == "success" else 0
        error = "연결 타임아웃" if status == "failed" else None
        histories.append(
            CollectionHistory(
                id=f"hist-{job_id}-{i+1:03d}",
                job_id=job_id,
                started_at=started,
                finished_at=started + timedelta(seconds=45) if status != "running" else None,
                status=status,
                items_collected=items,
                error_message=error,
            )
        )
    return histories


def get_dummy_stats() -> CollectorStats:
    return CollectorStats(
        total_jobs=8,
        active_jobs=6,
        total_collected=91350,
        last_24h_collected=3420,
        error_rate=2.1,
    )


def get_dummy_jobs() -> list[CollectorJob]:
    return COLLECTOR_JOBS


def get_dummy_history(job_id: str) -> list[CollectionHistory]:
    return _generate_history(job_id)
