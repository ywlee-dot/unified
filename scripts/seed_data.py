"""
시드 데이터 삽입 스크립트

사용법:
    docker compose exec backend python -m scripts.seed_data

환경변수:
    DATABASE_URL - PostgreSQL 연결 URL (기본값: postgresql+asyncpg://workspace:workspace@db:5432/workspace)
"""

import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# 환경 설정
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://workspace:workspace@db:5432/workspace",
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ---------------------------------------------------------------------------
# 더미 데이터 상수
# ---------------------------------------------------------------------------

NOW = datetime.now(timezone.utc)


def dt(days_ago: float = 0, hours_ago: float = 0) -> datetime:
    return NOW - timedelta(days=days_ago, hours=hours_ago)


def rand_dt(max_days: int = 30) -> datetime:
    return NOW - timedelta(
        days=random.uniform(0, max_days),
        hours=random.uniform(0, 24),
    )


# ---------------------------------------------------------------------------
# 테이블 생성 DDL
# ---------------------------------------------------------------------------

CREATE_TABLES_SQL = """
-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 데이터 수집기: 수집 작업
CREATE TABLE IF NOT EXISTS collector_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_url TEXT NOT NULL,
    schedule VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    total_collected INTEGER DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 데이터 수집기: 수집 이력
CREATE TABLE IF NOT EXISTS collection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES collector_jobs(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL,
    items_collected INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 분석 대시보드: 이벤트
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    properties JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 분석 대시보드: 리포트
CREATE TABLE IF NOT EXISTS analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    summary TEXT,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림 서비스: 채널
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_type VARCHAR(50) NOT NULL,
    config JSONB DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림 서비스: 템플릿
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    subject VARCHAR(300),
    body_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림 서비스: 발송 이력
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    template_name VARCHAR(200),
    channel VARCHAR(50) NOT NULL,
    recipient VARCHAR(300) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 콘텐츠 관리: 카테고리
CREATE TABLE IF NOT EXISTS content_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 콘텐츠 관리: 콘텐츠
CREATE TABLE IF NOT EXISTS contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    body TEXT NOT NULL,
    category_id UUID REFERENCES content_categories(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft',
    author VARCHAR(100) NOT NULL,
    tags JSONB DEFAULT '[]',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- n8n 실행 이력 (report_generator + data_pipeline 공용)
CREATE TABLE IF NOT EXISTS n8n_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_slug VARCHAR(100) NOT NULL,
    workflow_id VARCHAR(100) NOT NULL,
    workflow_name VARCHAR(200) NOT NULL,
    status VARCHAR(50) DEFAULT 'running',
    result_data JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""

# ---------------------------------------------------------------------------
# 더미 데이터
# ---------------------------------------------------------------------------

COLLECTOR_JOBS = [
    {
        "name": "네이버 뉴스 수집",
        "source_type": "web",
        "source_url": "https://news.naver.com/rss",
        "schedule": "0 */2 * * *",
        "status": "active",
        "total_collected": 15420,
    },
    {
        "name": "공공데이터 API",
        "source_type": "api",
        "source_url": "https://api.data.go.kr/sample",
        "schedule": "0 9 * * *",
        "status": "active",
        "total_collected": 8930,
    },
    {
        "name": "기상청 날씨 데이터",
        "source_type": "api",
        "source_url": "https://api.weather.go.kr/sample",
        "schedule": "0 */6 * * *",
        "status": "active",
        "total_collected": 4200,
    },
    {
        "name": "블로그 RSS 수집",
        "source_type": "rss",
        "source_url": "https://blog.example.com/feed",
        "schedule": "0 8 * * *",
        "status": "active",
        "total_collected": 2100,
    },
    {
        "name": "주가 데이터",
        "source_type": "api",
        "source_url": "https://api.stock.example.com/v1",
        "schedule": "*/5 9-16 * * 1-5",
        "status": "active",
        "total_collected": 52300,
    },
    {
        "name": "환율 정보",
        "source_type": "api",
        "source_url": "https://api.exchange.example.com",
        "schedule": "0 9 * * *",
        "status": "paused",
        "total_collected": 1800,
    },
    {
        "name": "소셜미디어 트렌드",
        "source_type": "web",
        "source_url": "https://trends.example.com",
        "schedule": "0 */4 * * *",
        "status": "active",
        "total_collected": 6700,
    },
    {
        "name": "레거시 시스템 연동",
        "source_type": "api",
        "source_url": "https://legacy.internal.com/api",
        "schedule": "0 2 * * *",
        "status": "error",
        "total_collected": 900,
    },
]

ANALYTICS_REPORTS = [
    {
        "title": "2026년 2월 월간 분석",
        "period_start": "2026-02-01",
        "period_end": "2026-02-28",
        "summary": "전월 대비 방문자 12% 증가",
        "metrics": {
            "total_views": 45200,
            "unique_users": 12300,
            "conversion_rate": 3.2,
            "avg_session_duration": 245,
        },
    },
    {
        "title": "2026년 1월 월간 분석",
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "summary": "신규 사용자 유입 증가세",
        "metrics": {
            "total_views": 40100,
            "unique_users": 10800,
            "conversion_rate": 2.9,
            "avg_session_duration": 230,
        },
    },
    {
        "title": "2025년 12월 월간 분석",
        "period_start": "2025-12-01",
        "period_end": "2025-12-31",
        "summary": "연말 프로모션으로 전환율 최고치 기록",
        "metrics": {
            "total_views": 58300,
            "unique_users": 18500,
            "conversion_rate": 4.1,
            "avg_session_duration": 310,
        },
    },
    {
        "title": "2025년 Q4 분기 분석",
        "period_start": "2025-10-01",
        "period_end": "2025-12-31",
        "summary": "4분기 목표 달성, 사용자 만족도 상승",
        "metrics": {
            "total_views": 148000,
            "unique_users": 42000,
            "conversion_rate": 3.5,
            "avg_session_duration": 275,
        },
    },
    {
        "title": "2026년 2월 3주차 주간 분석",
        "period_start": "2026-02-17",
        "period_end": "2026-02-23",
        "summary": "모바일 트래픽 30% 증가",
        "metrics": {
            "total_views": 11200,
            "unique_users": 3100,
            "conversion_rate": 3.0,
            "avg_session_duration": 220,
        },
    },
    {
        "title": "2026년 2월 4주차 주간 분석",
        "period_start": "2026-02-24",
        "period_end": "2026-03-02",
        "summary": "API 트래픽 안정화, 오류율 감소",
        "metrics": {
            "total_views": 12400,
            "unique_users": 3400,
            "conversion_rate": 3.3,
            "avg_session_duration": 238,
        },
    },
]

NOTIFICATION_TEMPLATES = [
    {
        "name": "가입 환영",
        "channel": "email",
        "subject": "환영합니다!",
        "body_template": "안녕하세요 {{name}}님, 가입을 환영합니다.",
        "variables": ["name"],
    },
    {
        "name": "비밀번호 재설정",
        "channel": "email",
        "subject": "비밀번호 재설정 안내",
        "body_template": "{{name}}님, 비밀번호 재설정 링크: {{link}}",
        "variables": ["name", "link"],
    },
    {
        "name": "주문 알림",
        "channel": "sms",
        "subject": None,
        "body_template": "[알림] {{item}} 주문이 완료되었습니다. 주문번호: {{order_id}}",
        "variables": ["item", "order_id"],
    },
    {
        "name": "시스템 장애 알림",
        "channel": "slack",
        "subject": None,
        "body_template": "[장애] {{service}} 서비스에서 오류 발생. 상세: {{detail}}",
        "variables": ["service", "detail"],
    },
    {
        "name": "일간 리포트 알림",
        "channel": "webhook",
        "subject": None,
        "body_template": '{"type": "daily_report", "date": "{{date}}", "summary": "{{summary}}"}',
        "variables": ["date", "summary"],
    },
    {
        "name": "배포 완료 알림",
        "channel": "slack",
        "subject": None,
        "body_template": "[배포] {{project}} v{{version}} 배포가 완료되었습니다.",
        "variables": ["project", "version"],
    },
]

NOTIFICATION_CHANNELS = [
    {
        "channel_type": "email",
        "config": {
            "smtp_host": "smtp.example.com",
            "smtp_port": 587,
            "from_email": "noreply@example.com",
        },
        "is_enabled": True,
    },
    {
        "channel_type": "sms",
        "config": {"provider": "twilio", "from_number": "+821012345678"},
        "is_enabled": True,
    },
    {
        "channel_type": "slack",
        "config": {"webhook_url": "https://hooks.slack.com/services/EXAMPLE"},
        "is_enabled": True,
    },
    {
        "channel_type": "webhook",
        "config": {"default_method": "POST", "timeout_seconds": 30},
        "is_enabled": False,
    },
]

CONTENT_CATEGORIES = [
    {"name": "공지사항", "slug": "notices", "description": "서비스 공지사항"},
    {"name": "기술 블로그", "slug": "tech-blog", "description": "기술 관련 포스트"},
    {"name": "튜토리얼", "slug": "tutorials", "description": "사용 가이드 및 튜토리얼"},
    {"name": "릴리즈 노트", "slug": "release-notes", "description": "버전별 변경사항"},
    {"name": "FAQ", "slug": "faq", "description": "자주 묻는 질문"},
]

CONTENTS = [
    {
        "title": "서비스 점검 안내 (3/5)",
        "body": "3월 5일 02:00-04:00 서비스 점검이 예정되어 있습니다. 점검 시간 동안 서비스 이용이 일시적으로 중단될 수 있으니 양해 부탁드립니다.",
        "category": "notices",
        "status": "published",
        "author": "admin",
        "tags": ["공지", "점검"],
    },
    {
        "title": "FastAPI와 Next.js 통합 가이드",
        "body": "이 글에서는 FastAPI 백엔드와 Next.js 프론트엔드를 효율적으로 통합하는 방법을 소개합니다. CORS 설정부터 타입 공유까지 단계별로 설명합니다.",
        "category": "tech-blog",
        "status": "published",
        "author": "dev-team",
        "tags": ["FastAPI", "Next.js", "통합"],
    },
    {
        "title": "v2.1.0 릴리즈 노트",
        "body": "주요 변경사항: 대시보드 성능 개선, 알림 채널 추가, 버그 수정 3건 포함.",
        "category": "release-notes",
        "status": "published",
        "author": "dev-team",
        "tags": ["릴리즈", "v2.1.0"],
    },
    {
        "title": "API 인증 가이드 (작성중)",
        "body": "JWT 토큰 기반 인증 사용 방법에 대해 설명합니다. 로그인 후 발급된 액세스 토큰을 Authorization 헤더에 포함시켜 API를 호출합니다.",
        "category": "tutorials",
        "status": "draft",
        "author": "dev-team",
        "tags": ["API", "인증"],
    },
    {
        "title": "자주 묻는 질문 - 데이터 수집기",
        "body": "Q: 수집 작업을 일시 중지하려면? A: 작업 상세 페이지에서 '일시 중지' 버튼을 클릭하세요.",
        "category": "faq",
        "status": "published",
        "author": "support-team",
        "tags": ["FAQ", "데이터 수집"],
    },
    {
        "title": "Docker Compose 개발 환경 설정",
        "body": "로컬 개발 환경을 Docker Compose로 빠르게 구성하는 방법을 설명합니다. PostgreSQL, Redis, n8n 서비스를 포함합니다.",
        "category": "tutorials",
        "status": "published",
        "author": "dev-team",
        "tags": ["Docker", "개발환경"],
    },
    {
        "title": "v2.0.0 릴리즈 노트",
        "body": "대규모 리팩터링: 모노레포 구조로 전환, 공통 컴포넌트 라이브러리 도입, TypeScript 마이그레이션 완료.",
        "category": "release-notes",
        "status": "published",
        "author": "dev-team",
        "tags": ["릴리즈", "v2.0.0", "모노레포"],
    },
    {
        "title": "알림 서비스 활용 가이드",
        "body": "이메일, SMS, Slack 등 다양한 채널로 알림을 발송하는 방법을 설명합니다. 템플릿 변수 사용법 포함.",
        "category": "tutorials",
        "status": "published",
        "author": "dev-team",
        "tags": ["알림", "튜토리얼"],
    },
    {
        "title": "시스템 보안 정책 업데이트",
        "body": "2026년 3월부터 API 키 만료 정책이 변경됩니다. 기존 키는 60일 이내에 재발급 받아 주세요.",
        "category": "notices",
        "status": "published",
        "author": "security-team",
        "tags": ["공지", "보안", "API키"],
    },
    {
        "title": "n8n 워크플로우 연동 방법",
        "body": "n8n 웹훅을 통해 자동화 워크플로우를 트리거하는 방법을 설명합니다. 리포트 생성기와 데이터 파이프라인 예시를 포함합니다.",
        "category": "tech-blog",
        "status": "published",
        "author": "dev-team",
        "tags": ["n8n", "자동화", "웹훅"],
    },
    {
        "title": "성능 최적화 사례 공유",
        "body": "대용량 데이터 처리 시 SQLAlchemy 비동기 세션과 Redis 캐시를 활용한 성능 개선 사례를 공유합니다.",
        "category": "tech-blog",
        "status": "draft",
        "author": "dev-team",
        "tags": ["성능", "SQLAlchemy", "Redis"],
    },
    {
        "title": "자주 묻는 질문 - 분석 대시보드",
        "body": "Q: 차트 데이터가 표시되지 않아요. A: 먼저 시드 데이터를 삽입했는지 확인하세요. scripts/seed_data.py를 실행해 주세요.",
        "category": "faq",
        "status": "published",
        "author": "support-team",
        "tags": ["FAQ", "분석"],
    },
    {
        "title": "v1.9.0 릴리즈 노트",
        "body": "분석 대시보드 차트 타입 추가 (파이 차트), 알림 템플릿 변수 검증 강화, 다국어 지원 기반 마련.",
        "category": "release-notes",
        "status": "published",
        "author": "dev-team",
        "tags": ["릴리즈", "v1.9.0"],
    },
    {
        "title": "콘텐츠 발행 워크플로우 가이드",
        "body": "초안 작성부터 검토, 발행까지의 전체 워크플로우를 설명합니다. 팀 협업 시 역할 분담 방법도 포함됩니다.",
        "category": "tutorials",
        "status": "review",
        "author": "content-team",
        "tags": ["콘텐츠", "워크플로우"],
    },
    {
        "title": "2026년 서비스 로드맵",
        "body": "2026년 상반기에는 모바일 앱 지원, 실시간 알림, AI 기반 분석 기능을 순차적으로 출시할 예정입니다.",
        "category": "notices",
        "status": "published",
        "author": "product-team",
        "tags": ["로드맵", "2026"],
    },
]

REPORT_RUNS = [
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-daily",
        "workflow_name": "일간 리포트 생성",
        "status": "completed",
        "result_data": {
            "report_url": "/reports/daily-2026-03-01.pdf",
            "pages": 5,
            "charts": 8,
        },
        "started_at": dt(days_ago=1, hours_ago=15),
        "finished_at": dt(days_ago=1, hours_ago=15) + timedelta(minutes=2, seconds=30),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-weekly",
        "workflow_name": "주간 리포트 생성",
        "status": "completed",
        "result_data": {
            "report_url": "/reports/weekly-2026-w09.pdf",
            "pages": 12,
            "charts": 15,
        },
        "started_at": dt(days_ago=6, hours_ago=15),
        "finished_at": dt(days_ago=6, hours_ago=15) + timedelta(minutes=5),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-daily",
        "workflow_name": "일간 리포트 생성",
        "status": "failed",
        "error_message": "데이터 소스 연결 타임아웃",
        "started_at": dt(days_ago=2, hours_ago=15),
        "finished_at": dt(days_ago=2, hours_ago=15) + timedelta(minutes=1),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-daily",
        "workflow_name": "일간 리포트 생성",
        "status": "completed",
        "result_data": {
            "report_url": "/reports/daily-2026-02-27.pdf",
            "pages": 5,
            "charts": 8,
        },
        "started_at": dt(days_ago=3, hours_ago=15),
        "finished_at": dt(days_ago=3, hours_ago=15) + timedelta(minutes=2, seconds=15),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-daily",
        "workflow_name": "일간 리포트 생성",
        "status": "completed",
        "result_data": {
            "report_url": "/reports/daily-2026-02-26.pdf",
            "pages": 4,
            "charts": 7,
        },
        "started_at": dt(days_ago=4, hours_ago=15),
        "finished_at": dt(days_ago=4, hours_ago=15) + timedelta(minutes=1, seconds=50),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-monthly",
        "workflow_name": "월간 리포트 생성",
        "status": "completed",
        "result_data": {
            "report_url": "/reports/monthly-2026-02.pdf",
            "pages": 24,
            "charts": 32,
        },
        "started_at": dt(days_ago=1),
        "finished_at": dt(days_ago=1) + timedelta(minutes=12),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-daily",
        "workflow_name": "일간 리포트 생성",
        "status": "completed",
        "result_data": {
            "report_url": "/reports/daily-2026-02-25.pdf",
            "pages": 5,
            "charts": 8,
        },
        "started_at": dt(days_ago=5, hours_ago=15),
        "finished_at": dt(days_ago=5, hours_ago=15) + timedelta(minutes=2),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-weekly",
        "workflow_name": "주간 리포트 생성",
        "status": "failed",
        "error_message": "템플릿 렌더링 오류: 누락된 데이터 필드",
        "started_at": dt(days_ago=13, hours_ago=15),
        "finished_at": dt(days_ago=13, hours_ago=15) + timedelta(minutes=3),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-daily",
        "workflow_name": "일간 리포트 생성",
        "status": "completed",
        "result_data": {
            "report_url": "/reports/daily-2026-02-20.pdf",
            "pages": 5,
            "charts": 9,
        },
        "started_at": dt(days_ago=10, hours_ago=15),
        "finished_at": dt(days_ago=10, hours_ago=15) + timedelta(minutes=2, seconds=45),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-monthly",
        "workflow_name": "월간 리포트 생성",
        "status": "completed",
        "result_data": {
            "report_url": "/reports/monthly-2026-01.pdf",
            "pages": 22,
            "charts": 28,
        },
        "started_at": dt(days_ago=30),
        "finished_at": dt(days_ago=30) + timedelta(minutes=10, seconds=30),
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-daily",
        "workflow_name": "일간 리포트 생성",
        "status": "running",
        "started_at": dt(hours_ago=0.5),
        "finished_at": None,
    },
    {
        "project_slug": "report-generator",
        "workflow_id": "generate-weekly",
        "workflow_name": "주간 리포트 생성",
        "status": "completed",
        "result_data": {
            "report_url": "/reports/weekly-2026-w08.pdf",
            "pages": 11,
            "charts": 14,
        },
        "started_at": dt(days_ago=13),
        "finished_at": dt(days_ago=13) + timedelta(minutes=4, seconds=20),
    },
]

PIPELINE_RUNS = [
    {
        "project_slug": "data-pipeline",
        "workflow_id": "etl-daily",
        "workflow_name": "일간 ETL 파이프라인",
        "status": "completed",
        "result_data": {
            "records_processed": 15420,
            "records_failed": 3,
            "duration_seconds": 180,
        },
        "started_at": dt(days_ago=1, hours_ago=22),
        "finished_at": dt(days_ago=1, hours_ago=22) + timedelta(minutes=3),
    },
    {
        "project_slug": "data-pipeline",
        "workflow_id": "sync-external",
        "workflow_name": "외부 DB 동기화",
        "status": "completed",
        "result_data": {
            "records_processed": 8200,
            "records_failed": 0,
            "duration_seconds": 95,
        },
        "started_at": dt(days_ago=1, hours_ago=21),
        "finished_at": dt(days_ago=1, hours_ago=21) + timedelta(seconds=95),
    },
    {
        "project_slug": "data-pipeline",
        "workflow_id": "etl-daily",
        "workflow_name": "일간 ETL 파이프라인",
        "status": "running",
        "started_at": dt(hours_ago=2),
        "finished_at": None,
    },
    {
        "project_slug": "data-pipeline",
        "workflow_id": "etl-daily",
        "workflow_name": "일간 ETL 파이프라인",
        "status": "completed",
        "result_data": {
            "records_processed": 14800,
            "records_failed": 12,
            "duration_seconds": 195,
        },
        "started_at": dt(days_ago=2, hours_ago=22),
        "finished_at": dt(days_ago=2, hours_ago=22) + timedelta(minutes=3, seconds=15),
    },
    {
        "project_slug": "data-pipeline",
        "workflow_id": "cleanup-archived",
        "workflow_name": "아카이브 정리",
        "status": "completed",
        "result_data": {
            "records_processed": 5600,
            "records_failed": 0,
            "duration_seconds": 45,
        },
        "started_at": dt(days_ago=3, hours_ago=3),
        "finished_at": dt(days_ago=3, hours_ago=3) + timedelta(seconds=45),
    },
    {
        "project_slug": "data-pipeline",
        "workflow_id": "sync-external",
        "workflow_name": "외부 DB 동기화",
        "status": "failed",
        "error_message": "외부 데이터베이스 연결 실패: Connection refused",
        "started_at": dt(days_ago=3, hours_ago=21),
        "finished_at": dt(days_ago=3, hours_ago=21) + timedelta(seconds=30),
    },
    {
        "project_slug": "data-pipeline",
        "workflow_id": "etl-daily",
        "workflow_name": "일간 ETL 파이프라인",
        "status": "completed",
        "result_data": {
            "records_processed": 16100,
            "records_failed": 5,
            "duration_seconds": 210,
        },
        "started_at": dt(days_ago=4, hours_ago=22),
        "finished_at": dt(days_ago=4, hours_ago=22) + timedelta(minutes=3, seconds=30),
    },
    {
        "project_slug": "data-pipeline",
        "workflow_id": "etl-weekly",
        "workflow_name": "주간 데이터 집계",
        "status": "completed",
        "result_data": {
            "records_processed": 98000,
            "records_failed": 22,
            "duration_seconds": 1200,
        },
        "started_at": dt(days_ago=7),
        "finished_at": dt(days_ago=7) + timedelta(minutes=20),
    },
    {
        "project_slug": "data-pipeline",
        "workflow_id": "etl-daily",
        "workflow_name": "일간 ETL 파이프라인",
        "status": "failed",
        "error_message": "메모리 부족: 처리 가능 용량 초과",
        "started_at": dt(days_ago=5, hours_ago=22),
        "finished_at": dt(days_ago=5, hours_ago=22) + timedelta(minutes=1, seconds=20),
    },
    {
        "project_slug": "data-pipeline",
        "workflow_id": "sync-external",
        "workflow_name": "외부 DB 동기화",
        "status": "completed",
        "result_data": {
            "records_processed": 7900,
            "records_failed": 0,
            "duration_seconds": 88,
        },
        "started_at": dt(days_ago=5, hours_ago=21),
        "finished_at": dt(days_ago=5, hours_ago=21) + timedelta(seconds=88),
    },
]

# ---------------------------------------------------------------------------
# 시드 함수
# ---------------------------------------------------------------------------

import json


async def seed_tables(session: AsyncSession) -> None:
    """모든 테이블 생성"""
    await session.execute(text(CREATE_TABLES_SQL))
    await session.commit()
    print("[1/8] 테이블 생성 완료")


async def seed_user(session: AsyncSession) -> None:
    """테스트 사용자 삽입"""
    # bcrypt 해시 없이 간단한 SHA-256 해시 사용 (scaffold 전용)
    import hashlib

    hashed = hashlib.sha256(b"password").hexdigest()

    await session.execute(
        text("""
            INSERT INTO users (email, hashed_password, full_name, is_admin)
            VALUES (:email, :hashed_password, :full_name, :is_admin)
            ON CONFLICT (email) DO NOTHING
        """),
        {
            "email": "admin@test.com",
            "hashed_password": hashed,
            "full_name": "관리자",
            "is_admin": True,
        },
    )
    await session.commit()
    print("[2/8] 테스트 사용자 생성: admin@test.com / password")


async def seed_collector(session: AsyncSession) -> None:
    """데이터 수집기 더미 데이터"""
    job_ids = []
    for job in COLLECTOR_JOBS:
        job_id = str(uuid.uuid4())
        job_ids.append(job_id)
        last_run = rand_dt(max_days=2)
        await session.execute(
            text("""
                INSERT INTO collector_jobs
                    (id, name, source_type, source_url, schedule, status, total_collected, last_run_at)
                VALUES
                    (:id, :name, :source_type, :source_url, :schedule, :status, :total_collected, :last_run_at)
                ON CONFLICT DO NOTHING
            """),
            {
                "id": job_id,
                "name": job["name"],
                "source_type": job["source_type"],
                "source_url": job["source_url"],
                "schedule": job.get("schedule"),
                "status": job["status"],
                "total_collected": job["total_collected"],
                "last_run_at": last_run,
            },
        )

    # 수집 이력 - 작업당 5건씩 40건
    statuses = ["success", "success", "success", "success", "failed"]
    for job_id in job_ids:
        for i in range(5):
            started = rand_dt(max_days=7)
            finished = started + timedelta(minutes=random.uniform(0.5, 10))
            status = statuses[i]
            await session.execute(
                text("""
                    INSERT INTO collection_history
                        (id, job_id, started_at, finished_at, status, items_collected, error_message)
                    VALUES
                        (:id, :job_id, :started_at, :finished_at, :status, :items_collected, :error_message)
                """),
                {
                    "id": str(uuid.uuid4()),
                    "job_id": job_id,
                    "started_at": started,
                    "finished_at": finished if status != "running" else None,
                    "status": status,
                    "items_collected": random.randint(50, 500) if status == "success" else 0,
                    "error_message": "연결 타임아웃" if status == "failed" else None,
                },
            )

    await session.commit()
    print("[3/8] 데이터 수집기: 수집 작업 8건, 수집 이력 40건 삽입")


async def seed_analytics(session: AsyncSession) -> None:
    """분석 대시보드 더미 데이터"""
    event_types = ["page_view", "click", "signup", "purchase", "search"]
    sources = ["web", "mobile", "api"]

    for _ in range(500):
        await session.execute(
            text("""
                INSERT INTO analytics_events
                    (id, event_type, source, user_id, session_id, properties, occurred_at)
                VALUES
                    (:id, :event_type, :source, :user_id, :session_id, :properties, :occurred_at)
            """),
            {
                "id": str(uuid.uuid4()),
                "event_type": random.choice(event_types),
                "source": random.choice(sources),
                "user_id": f"user_{random.randint(1, 200)}",
                "session_id": str(uuid.uuid4()),
                "properties": json.dumps({"page": f"/page/{random.randint(1, 20)}"}),
                "occurred_at": rand_dt(max_days=30),
            },
        )

    for report in ANALYTICS_REPORTS:
        await session.execute(
            text("""
                INSERT INTO analytics_reports
                    (id, title, period_start, period_end, summary, metrics)
                VALUES
                    (:id, :title, :period_start, :period_end, :summary, :metrics)
                ON CONFLICT DO NOTHING
            """),
            {
                "id": str(uuid.uuid4()),
                "title": report["title"],
                "period_start": report["period_start"],
                "period_end": report["period_end"],
                "summary": report["summary"],
                "metrics": json.dumps(report["metrics"]),
            },
        )

    await session.commit()
    print("[4/8] 분석 대시보드: 이벤트 500건, 리포트 6건 삽입")


async def seed_notifications(session: AsyncSession) -> None:
    """알림 서비스 더미 데이터"""
    # 채널
    for ch in NOTIFICATION_CHANNELS:
        await session.execute(
            text("""
                INSERT INTO notification_channels (id, channel_type, config, is_enabled)
                VALUES (:id, :channel_type, :config, :is_enabled)
                ON CONFLICT DO NOTHING
            """),
            {
                "id": str(uuid.uuid4()),
                "channel_type": ch["channel_type"],
                "config": json.dumps(ch["config"]),
                "is_enabled": ch["is_enabled"],
            },
        )

    # 템플릿
    template_ids = []
    template_names = []
    for tmpl in NOTIFICATION_TEMPLATES:
        tid = str(uuid.uuid4())
        template_ids.append(tid)
        template_names.append(tmpl["name"])
        await session.execute(
            text("""
                INSERT INTO notification_templates
                    (id, name, channel, subject, body_template, variables)
                VALUES
                    (:id, :name, :channel, :subject, :body_template, :variables)
                ON CONFLICT DO NOTHING
            """),
            {
                "id": tid,
                "name": tmpl["name"],
                "channel": tmpl["channel"],
                "subject": tmpl.get("subject"),
                "body_template": tmpl["body_template"],
                "variables": json.dumps(tmpl["variables"]),
            },
        )

    # 발송 이력 50건
    all_statuses = ["sent", "delivered", "delivered", "delivered", "failed", "pending"]
    channels = ["email", "sms", "slack", "webhook"]
    recipients = [
        "user1@example.com", "user2@example.com", "010-1234-5678",
        "team-channel", "https://hooks.example.com/notify",
    ]
    for _ in range(50):
        idx = random.randrange(len(template_ids))
        sent_time = rand_dt(max_days=14)
        status = random.choice(all_statuses)
        await session.execute(
            text("""
                INSERT INTO notification_history
                    (id, template_id, template_name, channel, recipient, status, sent_at, error_message)
                VALUES
                    (:id, :template_id, :template_name, :channel, :recipient, :status, :sent_at, :error_message)
            """),
            {
                "id": str(uuid.uuid4()),
                "template_id": template_ids[idx],
                "template_name": template_names[idx],
                "channel": random.choice(channels),
                "recipient": random.choice(recipients),
                "status": status,
                "sent_at": sent_time,
                "error_message": "SMTP 연결 오류" if status == "failed" else None,
            },
        )

    await session.commit()
    print("[5/8] 알림 서비스: 템플릿 6건, 발송 이력 50건, 채널 4건 삽입")


async def seed_content(session: AsyncSession) -> None:
    """콘텐츠 관리 더미 데이터"""
    category_map: dict[str, str] = {}
    for cat in CONTENT_CATEGORIES:
        cid = str(uuid.uuid4())
        category_map[cat["slug"]] = cid
        await session.execute(
            text("""
                INSERT INTO content_categories (id, name, slug, description)
                VALUES (:id, :name, :slug, :description)
                ON CONFLICT (slug) DO NOTHING
            """),
            {
                "id": cid,
                "name": cat["name"],
                "slug": cat["slug"],
                "description": cat["description"],
            },
        )

    for content in CONTENTS:
        cat_id = category_map.get(content["category"])
        published_at = rand_dt(max_days=60) if content["status"] == "published" else None
        await session.execute(
            text("""
                INSERT INTO contents
                    (id, title, body, category_id, status, author, tags, published_at)
                VALUES
                    (:id, :title, :body, :category_id, :status, :author, :tags, :published_at)
            """),
            {
                "id": str(uuid.uuid4()),
                "title": content["title"],
                "body": content["body"],
                "category_id": cat_id,
                "status": content["status"],
                "author": content["author"],
                "tags": json.dumps(content["tags"]),
                "published_at": published_at,
            },
        )

    await session.commit()
    print("[6/8] 콘텐츠 관리: 카테고리 5건, 콘텐츠 15건 삽입")


async def seed_n8n_executions(session: AsyncSession) -> None:
    """n8n 실행 이력 더미 데이터"""
    all_runs = REPORT_RUNS + PIPELINE_RUNS
    for run in all_runs:
        await session.execute(
            text("""
                INSERT INTO n8n_executions
                    (id, project_slug, workflow_id, workflow_name, status,
                     result_data, error_message, started_at, finished_at)
                VALUES
                    (:id, :project_slug, :workflow_id, :workflow_name, :status,
                     :result_data, :error_message, :started_at, :finished_at)
            """),
            {
                "id": str(uuid.uuid4()),
                "project_slug": run["project_slug"],
                "workflow_id": run["workflow_id"],
                "workflow_name": run["workflow_name"],
                "status": run["status"],
                "result_data": json.dumps(run.get("result_data")) if run.get("result_data") else None,
                "error_message": run.get("error_message"),
                "started_at": run["started_at"],
                "finished_at": run.get("finished_at"),
            },
        )

    await session.commit()
    print("[7/8] n8n 실행 이력: 리포트 생성기 12건, 데이터 파이프라인 10건 삽입")


async def verify_counts(session: AsyncSession) -> None:
    """삽입된 데이터 건수 확인"""
    tables = [
        "users", "collector_jobs", "collection_history",
        "analytics_events", "analytics_reports",
        "notification_templates", "notification_history", "notification_channels",
        "content_categories", "contents",
        "n8n_executions",
    ]
    print("\n[8/8] 삽입 결과 확인:")
    for table in tables:
        result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
        count = result.scalar()
        print(f"  - {table}: {count}건")


# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------

async def main() -> None:
    print("=" * 50)
    print("통합 워크스페이스 시드 데이터 삽입 시작")
    print(f"DATABASE_URL: {DATABASE_URL}")
    print("=" * 50)

    async with AsyncSessionLocal() as session:
        await seed_tables(session)
        await seed_user(session)
        await seed_collector(session)
        await seed_analytics(session)
        await seed_notifications(session)
        await seed_content(session)
        await seed_n8n_executions(session)
        await verify_counts(session)

    print("\n시드 데이터 삽입 완료!")


if __name__ == "__main__":
    asyncio.run(main())
