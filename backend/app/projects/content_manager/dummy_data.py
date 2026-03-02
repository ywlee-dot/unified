"""Dummy data for Content Manager project."""

from datetime import datetime, timedelta, timezone

from app.projects.content_manager.schemas import Category, Content

_now = datetime.now(timezone.utc)

CONTENT_CATEGORIES: list[Category] = [
    Category(id="cat-001", name="공지사항", slug="notices", description="서비스 공지사항", content_count=3, created_at=_now - timedelta(days=120)),
    Category(id="cat-002", name="기술 블로그", slug="tech-blog", description="기술 관련 포스트", content_count=4, created_at=_now - timedelta(days=100)),
    Category(id="cat-003", name="튜토리얼", slug="tutorials", description="사용 가이드 및 튜토리얼", content_count=3, created_at=_now - timedelta(days=80)),
    Category(id="cat-004", name="릴리즈 노트", slug="release-notes", description="버전별 변경사항", content_count=3, created_at=_now - timedelta(days=60)),
    Category(id="cat-005", name="FAQ", slug="faq", description="자주 묻는 질문", content_count=2, created_at=_now - timedelta(days=40)),
]

_cat_map = {c.slug: c for c in CONTENT_CATEGORIES}

CONTENTS: list[Content] = [
    Content(id="content-001", title="서비스 점검 안내 (3/5)", body="3월 5일 02:00-04:00 서비스 점검이 예정되어 있습니다. 점검 중 서비스 이용이 제한될 수 있습니다.", category_id="cat-001", category_name="공지사항", status="published", author="admin", tags=["공지", "점검"], published_at=_now - timedelta(days=1), created_at=_now - timedelta(days=2), updated_at=_now - timedelta(days=1)),
    Content(id="content-002", title="FastAPI와 Next.js 통합 가이드", body="이 글에서는 FastAPI 백엔드와 Next.js 프론트엔드를 효율적으로 통합하는 방법을 소개합니다. CORS 설정, API 클라이언트, SSR 환경 구성 등을 다룹니다.", category_id="cat-002", category_name="기술 블로그", status="published", author="dev-team", tags=["FastAPI", "Next.js", "통합"], published_at=_now - timedelta(days=5), created_at=_now - timedelta(days=7), updated_at=_now - timedelta(days=5)),
    Content(id="content-003", title="v2.1.0 릴리즈 노트", body="주요 변경사항: 대시보드 성능 개선, 알림 채널 추가, 버그 수정 15건", category_id="cat-004", category_name="릴리즈 노트", status="published", author="dev-team", tags=["릴리즈", "v2.1.0"], published_at=_now - timedelta(days=3), created_at=_now - timedelta(days=4), updated_at=_now - timedelta(days=3)),
    Content(id="content-004", title="API 인증 가이드 (작성중)", body="JWT 토큰 기반 인증 사용 방법. 로그인 API를 호출하여 토큰을 발급받고, Authorization 헤더에 포함하여 API를 호출합니다.", category_id="cat-003", category_name="튜토리얼", status="draft", author="dev-team", tags=["API", "인증"], published_at=None, created_at=_now - timedelta(days=3), updated_at=_now - timedelta(days=1)),
    Content(id="content-005", title="Docker Compose로 개발 환경 구축하기", body="Docker Compose를 활용하여 PostgreSQL, Redis, n8n을 포함한 통합 개발 환경을 구축하는 방법을 안내합니다.", category_id="cat-003", category_name="튜토리얼", status="published", author="dev-team", tags=["Docker", "개발환경"], published_at=_now - timedelta(days=10), created_at=_now - timedelta(days=12), updated_at=_now - timedelta(days=10)),
    Content(id="content-006", title="데이터 파이프라인 아키텍처 설계", body="n8n을 활용한 ETL 파이프라인 아키텍처 설계 원칙과 베스트 프랙티스를 공유합니다.", category_id="cat-002", category_name="기술 블로그", status="published", author="data-team", tags=["파이프라인", "아키텍처", "n8n"], published_at=_now - timedelta(days=8), created_at=_now - timedelta(days=10), updated_at=_now - timedelta(days=8)),
    Content(id="content-007", title="v2.0.0 릴리즈 노트", body="메이저 업데이트: 모노레포 전환, 통합 대시보드, n8n 연동 추가", category_id="cat-004", category_name="릴리즈 노트", status="published", author="dev-team", tags=["릴리즈", "v2.0.0"], published_at=_now - timedelta(days=20), created_at=_now - timedelta(days=21), updated_at=_now - timedelta(days=20)),
    Content(id="content-008", title="신규 기능 안내: 알림 서비스", body="다양한 채널(이메일, SMS, Slack, 웹훅)을 통한 알림 발송 기능이 추가되었습니다.", category_id="cat-001", category_name="공지사항", status="published", author="admin", tags=["공지", "신규기능"], published_at=_now - timedelta(days=14), created_at=_now - timedelta(days=15), updated_at=_now - timedelta(days=14)),
    Content(id="content-009", title="모니터링 대시보드 사용법", body="분석 대시보드를 활용하여 서비스 현황을 모니터링하는 방법을 안내합니다.", category_id="cat-003", category_name="튜토리얼", status="review", author="dev-team", tags=["모니터링", "대시보드"], published_at=None, created_at=_now - timedelta(days=5), updated_at=_now - timedelta(days=2)),
    Content(id="content-010", title="Pydantic v2 마이그레이션 가이드", body="Pydantic v1에서 v2로 마이그레이션하는 과정에서 발생하는 주요 변경사항과 해결 방법을 정리합니다.", category_id="cat-002", category_name="기술 블로그", status="published", author="dev-team", tags=["Pydantic", "마이그레이션"], published_at=_now - timedelta(days=15), created_at=_now - timedelta(days=18), updated_at=_now - timedelta(days=15)),
    Content(id="content-011", title="자주 묻는 질문 모음", body="Q: 비밀번호를 잊어버렸어요. A: 로그인 페이지의 '비밀번호 찾기'를 이용하세요.", category_id="cat-005", category_name="FAQ", status="published", author="admin", tags=["FAQ"], published_at=_now - timedelta(days=25), created_at=_now - timedelta(days=30), updated_at=_now - timedelta(days=25)),
    Content(id="content-012", title="API Rate Limiting 정책", body="API 요청 제한 정책: 분당 60회, 시간당 1000회. 초과 시 429 상태 코드가 반환됩니다.", category_id="cat-005", category_name="FAQ", status="published", author="admin", tags=["API", "정책"], published_at=_now - timedelta(days=20), created_at=_now - timedelta(days=22), updated_at=_now - timedelta(days=20)),
    Content(id="content-013", title="SQLAlchemy 비동기 패턴", body="FastAPI와 SQLAlchemy 2.0의 비동기 세션을 활용한 데이터베이스 연동 패턴을 소개합니다.", category_id="cat-002", category_name="기술 블로그", status="draft", author="dev-team", tags=["SQLAlchemy", "비동기"], published_at=None, created_at=_now - timedelta(days=2), updated_at=_now - timedelta(hours=12)),
    Content(id="content-014", title="v1.9.0 릴리즈 노트", body="변경사항: 수집기 스케줄러 개선, 리포트 템플릿 추가, 성능 최적화", category_id="cat-004", category_name="릴리즈 노트", status="archived", author="dev-team", tags=["릴리즈", "v1.9.0"], published_at=_now - timedelta(days=45), created_at=_now - timedelta(days=46), updated_at=_now - timedelta(days=30)),
    Content(id="content-015", title="서버 이전 안내", body="3월 15일 서버 이전 작업이 예정되어 있습니다. 최대 2시간의 서비스 중단이 발생할 수 있습니다.", category_id="cat-001", category_name="공지사항", status="draft", author="admin", tags=["공지", "서버"], published_at=None, created_at=_now - timedelta(hours=6), updated_at=_now - timedelta(hours=3)),
]


def get_dummy_categories() -> list[Category]:
    return CONTENT_CATEGORIES


def get_dummy_contents() -> list[Content]:
    return CONTENTS
