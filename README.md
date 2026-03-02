# 통합 워크스페이스 (Unified Workspace)

6개의 독립 프로젝트를 하나의 모노레포로 통합한 scaffold 시스템입니다.
FastAPI 백엔드와 Next.js 프론트엔드를 Docker Compose로 단일 환경에서 운영합니다.

---

## 빠른 시작

```bash
# 1. 저장소 클론
git clone <repository-url>
cd unified-workspace

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 필요한 값을 수정하세요

# 3. 전체 서비스 기동
docker compose up -d

# 4. 시드 데이터 삽입 (선택)
docker compose exec backend python -m scripts.seed_data

# 5. 서비스 확인
./scripts/health_check.sh
```

접속:
- 대시보드: http://localhost:3000
- API 문서(Swagger): http://localhost:8000/api/docs
- n8n: http://localhost:5678

---

## 기술 스택

**백엔드**
- Python 3.12 + FastAPI
- SQLAlchemy 2.0 (비동기) + PostgreSQL
- Alembic (마이그레이션)
- Pydantic v2 + pydantic-settings
- Redis (세션 캐싱)

**프론트엔드**
- Next.js 14 (App Router)
- TypeScript 5
- Tailwind CSS

**인프라**
- Docker Compose
- PostgreSQL 16
- Redis 7
- n8n (워크플로우 자동화)

---

## 프로젝트 구조

```
unified-workspace/
├── backend/                # FastAPI 백엔드
│   └── app/
│       ├── main.py         # 앱 진입점
│       ├── config.py       # 환경 설정
│       ├── registry/       # 프로젝트 자동 등록
│       ├── shared/         # 공통 모듈 (auth, models, schemas)
│       └── projects/       # 6개 프로젝트 모듈
├── frontend/               # Next.js 프론트엔드
│   └── src/
│       ├── app/            # 페이지 (App Router)
│       ├── components/     # 공통 컴포넌트
│       ├── lib/            # API 클라이언트, 타입
│       └── hooks/          # 커스텀 훅
├── scripts/                # 유틸리티 스크립트
│   ├── seed_data.py        # DB 시드 데이터
│   ├── create_project.sh   # 새 프로젝트 scaffold 생성
│   └── health_check.sh     # 서비스 헬스체크
├── docs/                   # 문서
│   ├── architecture.md     # 아키텍처 설명
│   ├── adding-new-project.md
│   └── api-reference.md
├── docker-compose.yml
└── .env.example
```

---

## 포함된 프로젝트

| 이름 | 슬러그 | 타입 | 설명 |
|------|--------|------|------|
| 데이터 수집기 | `data-collector` | standard | 외부 소스에서 데이터 수집 |
| 분석 대시보드 | `analytics` | standard | 데이터 시각화 및 리포트 |
| 알림 서비스 | `notifications` | standard | 이메일/SMS/Slack 알림 발송 |
| 콘텐츠 관리 | `content-manager` | standard | 콘텐츠 CRUD 및 발행 관리 |
| 리포트 생성기 | `report-generator` | n8n | n8n 워크플로우로 리포트 자동 생성 |
| 데이터 파이프라인 | `data-pipeline` | n8n | n8n 워크플로우로 ETL 파이프라인 실행 |

---

## 개발 가이드

### 백엔드 개발

```bash
# 백엔드 컨테이너에 접속
docker compose exec backend bash

# 의존성 추가 후 재빌드
docker compose build backend
docker compose up -d backend

# 로그 확인
docker compose logs -f backend

# DB 마이그레이션
docker compose exec backend alembic revision --autogenerate -m "설명"
docker compose exec backend alembic upgrade head
```

### 프론트엔드 개발

```bash
# 프론트엔드 컨테이너에 접속
docker compose exec frontend bash

# 로그 확인
docker compose logs -f frontend
```

### 전체 재시작

```bash
docker compose restart
```

### 데이터 초기화

```bash
# 볼륨 포함 전체 삭제 (데이터 모두 삭제됨)
docker compose down -v
docker compose up -d
docker compose exec backend python -m scripts.seed_data
```

---

## 새 프로젝트 추가

scaffold 스크립트로 30초 안에 새 프로젝트를 추가할 수 있습니다.

```bash
# 표준 프로젝트
./scripts/create_project.sh my-project "내 프로젝트" standard

# n8n 워크플로우 프로젝트
./scripts/create_project.sh my-workflow "내 워크플로우" n8n
```

상세 절차는 [docs/adding-new-project.md](./docs/adding-new-project.md)를 참조하세요.

---

## API 문서

- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **API 레퍼런스 문서**: [docs/api-reference.md](./docs/api-reference.md)

---

## 환경 변수

`.env.example`을 복사해 `.env`를 생성한 후 아래 항목을 설정합니다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `POSTGRES_USER` | `workspace` | DB 사용자명 |
| `POSTGRES_PASSWORD` | `workspace` | DB 비밀번호 |
| `POSTGRES_DB` | `workspace` | DB 이름 |
| `DATABASE_URL` | `postgresql+asyncpg://...` | FastAPI DB 연결 URL |
| `REDIS_URL` | `redis://redis:6379/0` | Redis 연결 URL |
| `N8N_BASE_URL` | `http://n8n:5678` | n8n 서버 URL |
| `SECRET_KEY` | `change-me-in-production` | JWT 서명 키 (운영 시 반드시 변경) |
| `DEBUG` | `false` | 디버그 모드 |

> **주의**: `SECRET_KEY`는 운영 배포 전 반드시 안전한 랜덤 값으로 교체해야 합니다.

---

## 테스트 계정

시드 데이터 삽입 후 아래 계정으로 로그인할 수 있습니다.

| 이메일 | 비밀번호 |
|--------|----------|
| admin@test.com | password |

---

## 아키텍처 개요

자세한 내용은 [docs/architecture.md](./docs/architecture.md)를 참조하세요.

```
브라우저 → Next.js (3000) → FastAPI (8000) → PostgreSQL (5432)
                                           → Redis (6379)
                                           → n8n (5678)
```

---

## 라이선스

이 프로젝트는 scaffold 목적으로 작성되었습니다. 실제 비즈니스 로직은 포함되지 않습니다.
