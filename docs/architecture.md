# 아키텍처 개요

> 통합 워크스페이스 - 기술 아키텍처 문서

---

## 1. 프로젝트 개요

통합 워크스페이스는 6개의 독립적인 프로젝트를 하나의 모노레포로 통합한 scaffold 시스템입니다.

### 목표

- 개별 프로젝트의 독립성을 유지하면서 공통 인프라를 공유
- 새 프로젝트를 플러그인 방식으로 손쉽게 추가
- Docker Compose 한 번으로 전체 서비스 기동

### 통합된 프로젝트

| 슬러그 | 이름 | 타입 |
|--------|------|------|
| `data-collector` | 데이터 수집기 | standard |
| `analytics` | 분석 대시보드 | standard |
| `notifications` | 알림 서비스 | standard |
| `content-manager` | 콘텐츠 관리 | standard |
| `report-generator` | 리포트 생성기 | n8n |
| `data-pipeline` | 데이터 파이프라인 | n8n |

---

## 2. 기술 스택

### 백엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| Python | 3.12+ | 런타임 |
| FastAPI | 0.115+ | REST API 서버 |
| SQLAlchemy | 2.0+ | ORM (비동기) |
| asyncpg | 0.29+ | PostgreSQL 비동기 드라이버 |
| Alembic | 1.13+ | DB 마이그레이션 |
| Pydantic v2 | 2.6+ | 데이터 검증 |
| pydantic-settings | 2.2+ | 환경 설정 |
| python-jose | 3.3+ | JWT 처리 |

### 프론트엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 14+ (App Router) | 프레임워크 |
| TypeScript | 5.0+ | 타입 안전성 |
| Tailwind CSS | 3.4+ | 스타일링 |
| React | 18+ | UI 라이브러리 |

### 인프라

| 서비스 | 포트 | 용도 |
|--------|------|------|
| PostgreSQL | 5432 | 주 데이터베이스 |
| Redis | 6379 | 세션 캐싱 |
| n8n | 5678 | 워크플로우 자동화 |

---

## 3. 디렉토리 구조 요약

```
unified-workspace/
├── backend/            # FastAPI 백엔드
│   └── app/
│       ├── main.py     # 앱 진입점
│       ├── config.py   # 환경 설정
│       ├── database.py # DB 세션
│       ├── registry/   # 프로젝트 자동 등록
│       ├── shared/     # 공통 모듈
│       └── projects/   # 6개 프로젝트 모듈
│           ├── data_collector/
│           ├── analytics/
│           ├── notifications/
│           ├── content_manager/
│           ├── report_generator/
│           └── data_pipeline/
│
├── frontend/           # Next.js 프론트엔드
│   └── src/
│       ├── app/
│       │   ├── page.tsx           # 대시보드 홈
│       │   └── projects/          # 프로젝트 페이지
│       ├── components/            # 공통 컴포넌트
│       ├── lib/                   # API 클라이언트, 타입
│       └── hooks/                 # 커스텀 훅
│
├── scripts/            # 유틸리티 스크립트
│   ├── seed_data.py    # DB 시드 데이터
│   ├── create_project.sh
│   └── health_check.sh
│
└── docs/               # 문서
```

---

## 4. 모듈 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                    │
│                                                         │
│  ┌─────────┐  ┌──────────────────────────────────────┐  │
│  │Dashboard│  │         Project Pages                │  │
│  │  Home   │  │  data-collector | analytics |        │  │
│  │         │  │  notifications  | content-manager |  │  │
│  └────┬────┘  │  report-generator | data-pipeline   │  │
│       │       └──────────────┬───────────────────────┘  │
│       │                      │                          │
│       └──────────┬───────────┘                          │
│                  │  fetch (HTTP)                        │
└──────────────────┼──────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────────────────────┐
│                  │      FastAPI Backend                  │
│                  │                                       │
│  ┌───────────────▼──────────────────────────────────┐   │
│  │                   main.py                        │   │
│  │           CORS Middleware + Router                │   │
│  └──┬────────────────┬──────────────────────────────┘   │
│     │                │                                   │
│  ┌──▼──────────┐  ┌──▼────────────────────────────────┐ │
│  │  /api/auth  │  │     ProjectRegistry (auto-discover) │ │
│  │  /api/health│  │                                     │ │
│  │  /api/registry  │  ┌─────────────────────────────┐  │ │
│  └─────────────┘  │  │  /api/projects/{slug}/*      │  │ │
│                   │  │  ┌──────────┐ ┌───────────┐  │  │ │
│                   │  │  │ router   │ │  service  │  │  │ │
│                   │  │  └──────────┘ └─────┬─────┘  │  │ │
│                   │  │                     │         │  │ │
│                   │  │  ┌──────────────────▼──────┐  │  │ │
│                   │  │  │  dummy_data / DB query  │  │  │ │
│                   │  │  └─────────────────────────┘  │  │ │
│                   │  └─────────────────────────────┘  │ │
│                   └───────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                   │                │
        ┌──────────▼──────┐  ┌──────▼──────┐
        │   PostgreSQL    │  │    Redis    │
        │   :5432         │  │    :6379    │
        └─────────────────┘  └─────────────┘

                   n8n 연동 (report-generator, data-pipeline)

┌──────────────────────────────────────────────────────────┐
│                         n8n                              │
│                        :5678                             │
│                                                          │
│  ┌─────────────────┐   ┌────────────────────────────┐   │
│  │ report-generator│   │     data-pipeline          │   │
│  │ Webhook Trigger │   │     Webhook Trigger        │   │
│  └────────┬────────┘   └───────────┬────────────────┘   │
│           │  워크플로우 실행          │                   │
│           └──────────────┬──────────┘                   │
│                          │ 콜백 (POST /api/n8n/callback) │
└──────────────────────────┼──────────────────────────────┘
                           │
                    FastAPI Backend
```

---

## 5. 데이터 흐름

### 5.1 표준 프로젝트 (standard) 데이터 흐름

```
사용자 브라우저
    │
    │  1. GET /projects/data-collector
    ▼
Next.js Page (SSR/CSR)
    │
    │  2. fetch('/api/projects/data-collector/jobs')
    ▼
FastAPI Router
    │
    │  3. DB 조회 (없으면 dummy_data.py 반환)
    ▼
SQLAlchemy AsyncSession
    │
    ▼
PostgreSQL
```

### 5.2 n8n 프로젝트 데이터 흐름

```
사용자 브라우저
    │
    │  1. 트리거 버튼 클릭
    ▼
Next.js TriggerButton
    │
    │  2. POST /api/projects/report-generator/trigger/{workflow_id}
    ▼
FastAPI Router
    │
    │  3. n8n 웹훅 호출 (N8nClient)
    ▼
n8n Webhook → 워크플로우 실행
    │
    │  4. 완료 후 콜백
    │  POST /api/n8n/callback/{run_id}
    ▼
FastAPI (n8n_executions 업데이트)
    │
    │  5. 프론트엔드 폴링
    │  GET /api/projects/report-generator/runs/{run_id}
    ▼
사용자 결과 확인
```

---

## 6. 프로젝트 레지스트리 패턴

레지스트리 시스템은 각 프로젝트 모듈의 `manifest.py`를 자동으로 탐색하여 FastAPI 앱에 등록합니다.

### 등록 과정

```
1. 앱 시작 시 ProjectRegistry.auto_discover_and_register() 호출
      │
      ▼
2. backend/app/projects/ 하위 디렉토리 순회
      │
      ▼
3. 각 디렉토리의 manifest.py 에서 manifest 객체 로드
      │
      ▼
4. manifest.router_module 에서 router 객체 임포트
      │
      ▼
5. app.include_router(router, prefix="/api/projects/{slug}")
```

### manifest.py 구조

```python
manifest = ProjectManifest(
    slug="my-project",          # URL 슬러그
    name="내 프로젝트",          # 표시 이름
    description="...",          # 설명
    version="1.0.0",
    project_type="standard",    # "standard" | "n8n"
    icon="folder",              # 아이콘 이름
    color="#3B82F6",            # 테마 색상
    enabled=True,               # 활성화 여부
    router_module="app.projects.my_project.router",
)
```

### 새 프로젝트 추가 방법

`manifest.py`를 작성하고 해당 디렉토리를 만들면 자동으로 등록됩니다.
상세 절차는 [docs/adding-new-project.md](./adding-new-project.md)를 참조하세요.

---

## 7. 인증 구조

> **주의**: 현재 인증은 scaffold 수준입니다. 프로덕션 배포 전 반드시 보안 강화가 필요합니다.

```
POST /api/auth/login
  body: { email, password }
    │
    ▼
  하드코딩 검증 (admin@test.com / password)
    │
    ▼
  JWT 액세스 토큰 발급
    │
    ▼
  Authorization: Bearer <token>
  (선택적 적용 - 프로젝트 엔드포인트에 강제 적용 안 됨)
```

---

## 8. 환경 변수

주요 환경 변수 목록은 `.env.example` 파일을 참조하세요.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL 연결 URL |
| `REDIS_URL` | `redis://redis:6379/0` | Redis 연결 URL |
| `N8N_BASE_URL` | `http://n8n:5678` | n8n 서버 URL |
| `N8N_WEBHOOK_BASE` | `http://n8n:5678/webhook` | n8n 웹훅 베이스 URL |
| `SECRET_KEY` | `change-me-in-production` | JWT 서명 키 |
| `DEBUG` | `false` | 디버그 모드 |
