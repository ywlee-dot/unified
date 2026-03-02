# API 레퍼런스

> 통합 워크스페이스 REST API 문서입니다.
>
> 전체 API 명세는 Swagger UI에서 확인할 수 있습니다: `http://localhost:8000/api/docs`

---

## 공통 사항

### 기본 URL

```
http://localhost:8000/api
```

### 응답 형식

모든 API는 다음 형식으로 응답합니다.

```json
{
  "success": true,
  "data": { ... },
  "message": null,
  "error": null
}
```

오류 시:

```json
{
  "success": false,
  "data": null,
  "message": null,
  "error": "오류 메시지",
  "detail": "상세 내용",
  "status_code": 400
}
```

### 페이지네이션 응답

목록 API는 아래 형식을 사용합니다.

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

---

## 공통 엔드포인트

### 헬스체크

```http
GET /api/health
```

**응답 (200)**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-02T12:00:00Z"
}
```

---

### 인증

#### 로그인

```http
POST /api/auth/login
Content-Type: application/json
```

**요청 본문**

```json
{
  "email": "admin@test.com",
  "password": "password"
}
```

**응답 (200)**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### 토큰 갱신

```http
POST /api/auth/refresh
Authorization: Bearer <token>
```

---

### 프로젝트 레지스트리

#### 프로젝트 목록 조회

```http
GET /api/registry/projects
```

**응답 (200)**

```json
{
  "success": true,
  "data": [
    {
      "slug": "data-collector",
      "name": "데이터 수집기",
      "description": "외부 API 및 웹 소스에서 데이터를 수집하여 저장",
      "version": "1.0.0",
      "project_type": "standard",
      "icon": "database",
      "color": "#3B82F6",
      "enabled": true
    },
    ...
  ]
}
```

#### 프로젝트 상세 조회

```http
GET /api/registry/projects/{slug}
```

**경로 파라미터**

| 파라미터 | 설명 |
|----------|------|
| `slug` | 프로젝트 슬러그 (예: `data-collector`) |

---

## 프로젝트 A: 데이터 수집기

**기본 경로**: `/api/projects/data-collector`

### 수집 작업 목록

```http
GET /api/projects/data-collector/jobs
```

**쿼리 파라미터**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `page` | integer | 1 | 페이지 번호 |
| `page_size` | integer | 20 | 페이지 크기 |
| `status` | string | - | 필터: `active` \| `paused` \| `error` |

**응답 예시**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "네이버 뉴스 수집",
        "source_type": "web",
        "source_url": "https://news.naver.com/rss",
        "schedule": "0 */2 * * *",
        "status": "active",
        "last_run_at": "2026-03-02T10:00:00Z",
        "collected_count": 15420,
        "created_at": "2026-01-01T00:00:00Z"
      }
    ],
    "total": 8,
    "page": 1,
    "page_size": 20,
    "total_pages": 1
  }
}
```

### 수집 작업 상세

```http
GET /api/projects/data-collector/jobs/{job_id}
```

### 수집 작업 생성

```http
POST /api/projects/data-collector/jobs
Content-Type: application/json

{
  "name": "새 수집 작업",
  "source_type": "api",
  "source_url": "https://api.example.com/data",
  "schedule": "0 9 * * *"
}
```

### 수집 작업 수동 실행

```http
POST /api/projects/data-collector/jobs/{job_id}/run
```

### 수집 이력 조회

```http
GET /api/projects/data-collector/jobs/{job_id}/history
```

### 통계 조회

```http
GET /api/projects/data-collector/stats
```

**응답 예시**

```json
{
  "success": true,
  "data": {
    "total_jobs": 8,
    "active_jobs": 6,
    "total_collected": 91350,
    "last_24h_collected": 3420,
    "error_rate": 2.1
  }
}
```

---

## 프로젝트 B: 분석 대시보드

**기본 경로**: `/api/projects/analytics`

### 대시보드 요약

```http
GET /api/projects/analytics/dashboard
```

**쿼리 파라미터**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `period` | string | `today` | `today` \| `week` \| `month` |

### 차트 데이터

```http
GET /api/projects/analytics/charts/{chart_type}
```

**경로 파라미터**

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `chart_type` | `line` | 라인 차트 (시간별 추이) |
| `chart_type` | `bar` | 막대 차트 (소스별 분포) |
| `chart_type` | `pie` | 파이 차트 (트래픽 소스) |

**응답 예시**

```json
{
  "success": true,
  "data": {
    "chart_type": "line",
    "labels": ["1월", "2월", "3월", "4월", "5월", "6월"],
    "datasets": [
      {
        "label": "방문자",
        "data": [4200, 5100, 4800, 6200, 5900, 7100],
        "color": "#3B82F6"
      }
    ]
  }
}
```

### 분석 리포트 목록

```http
GET /api/projects/analytics/reports
```

### 기간별 통계

```http
GET /api/projects/analytics/stats/summary?start=2026-02-01&end=2026-02-28
```

---

## 프로젝트 C: 알림 서비스

**기본 경로**: `/api/projects/notifications`

### 템플릿 목록

```http
GET /api/projects/notifications/templates
```

### 템플릿 생성

```http
POST /api/projects/notifications/templates
Content-Type: application/json

{
  "name": "신규 템플릿",
  "channel": "email",
  "subject": "제목: {{title}}",
  "body_template": "안녕하세요 {{name}}님, {{message}}",
  "variables": ["name", "title", "message"]
}
```

**채널 종류**: `email` | `sms` | `slack` | `webhook`

### 알림 발송

```http
POST /api/projects/notifications/send
Content-Type: application/json

{
  "template_id": "uuid",
  "channel": "email",
  "recipients": ["user@example.com"],
  "variables": {
    "name": "홍길동",
    "message": "안내 메시지"
  }
}
```

### 발송 이력

```http
GET /api/projects/notifications/history?page=1&page_size=20
```

### 채널 설정

```http
GET /api/projects/notifications/channels
```

### 발송 통계

```http
GET /api/projects/notifications/stats
```

**응답 예시**

```json
{
  "success": true,
  "data": {
    "total_sent": 50,
    "delivered": 42,
    "failed": 5,
    "delivery_rate": 84.0,
    "by_channel": {
      "email": 20,
      "sms": 15,
      "slack": 12,
      "webhook": 3
    }
  }
}
```

---

## 프로젝트 D: 콘텐츠 관리

**기본 경로**: `/api/projects/content-manager`

### 콘텐츠 목록

```http
GET /api/projects/content-manager/contents?page=1&status=published&category_id=uuid
```

**쿼리 파라미터**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `page` | integer | 페이지 번호 |
| `status` | string | `draft` \| `review` \| `published` \| `archived` |
| `category_id` | string | 카테고리 UUID 필터 |

### 콘텐츠 생성

```http
POST /api/projects/content-manager/contents
Content-Type: application/json

{
  "title": "새 콘텐츠 제목",
  "body": "콘텐츠 본문...",
  "category_id": "uuid",
  "tags": ["태그1", "태그2"]
}
```

### 콘텐츠 발행

```http
POST /api/projects/content-manager/contents/{content_id}/publish
```

### 카테고리 목록

```http
GET /api/projects/content-manager/categories
```

---

## 프로젝트 E: 리포트 생성기 (n8n)

**기본 경로**: `/api/projects/report-generator`

### 워크플로우 목록

```http
GET /api/projects/report-generator/workflows
```

**응답 예시**

```json
{
  "success": true,
  "data": [
    {
      "id": "generate-daily",
      "name": "일간 리포트 생성",
      "description": "매일 일간 통계 리포트를 생성합니다",
      "trigger_type": "manual",
      "status": "active",
      "last_run_at": "2026-03-02T09:02:30Z"
    }
  ]
}
```

### 워크플로우 트리거

```http
POST /api/projects/report-generator/trigger/{workflow_id}
Content-Type: application/json

{
  "parameters": {
    "date": "2026-03-02",
    "format": "pdf"
  }
}
```

**응답 예시**

```json
{
  "success": true,
  "data": {
    "run_id": "uuid",
    "status": "triggered",
    "message": "워크플로우 실행이 요청되었습니다."
  }
}
```

### 실행 이력

```http
GET /api/projects/report-generator/runs
```

### 실행 상세 및 결과

```http
GET /api/projects/report-generator/runs/{run_id}
```

**응답 예시**

```json
{
  "success": true,
  "data": {
    "run_id": "uuid",
    "workflow_id": "generate-daily",
    "workflow_name": "일간 리포트 생성",
    "status": "completed",
    "started_at": "2026-03-02T09:00:00Z",
    "finished_at": "2026-03-02T09:02:30Z",
    "result_data": {
      "report_url": "/reports/daily-2026-03-02.pdf",
      "pages": 5,
      "charts": 8
    },
    "download_url": "/api/projects/report-generator/runs/{run_id}/download",
    "error_message": null
  }
}
```

---

## 프로젝트 F: 데이터 파이프라인 (n8n)

**기본 경로**: `/api/projects/data-pipeline`

### 파이프라인 목록

```http
GET /api/projects/data-pipeline/pipelines
```

### 파이프라인 실행 트리거

```http
POST /api/projects/data-pipeline/pipelines/{pipeline_id}/trigger
Content-Type: application/json

{
  "parameters": {
    "source": "db-primary",
    "destination": "data-warehouse"
  },
  "dry_run": false
}
```

### 실행 이력

```http
GET /api/projects/data-pipeline/runs
```

### 실행 로그

```http
GET /api/projects/data-pipeline/runs/{run_id}/logs
```

**응답 예시**

```json
{
  "success": true,
  "data": {
    "run_id": "uuid",
    "logs": [
      "[2026-03-02T02:00:01Z] 파이프라인 시작",
      "[2026-03-02T02:00:05Z] 소스 연결 완료",
      "[2026-03-02T02:02:45Z] 15,420건 처리 완료",
      "[2026-03-02T02:03:00Z] 파이프라인 완료"
    ]
  }
}
```

---

## n8n 콜백 엔드포인트

n8n 워크플로우가 완료된 후 백엔드에 결과를 전달할 때 사용합니다.

```http
POST /api/n8n/callback/{run_id}
Content-Type: application/json
X-N8N-Callback-Secret: {N8N_CALLBACK_SECRET}

{
  "status": "completed",
  "result_data": { ... },
  "error_message": null
}
```

---

## 인증 가이드

### 토큰 획득

```bash
# 로그인 및 토큰 획득
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

### 인증된 요청

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/projects/data-collector/stats
```

> **주의**: 현재 scaffold에서 프로젝트 엔드포인트는 인증 없이도 접근 가능합니다.
> 프로덕션 배포 전 반드시 인증 미들웨어를 적용해야 합니다.

---

## HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| `200` | 성공 |
| `201` | 생성 성공 |
| `400` | 잘못된 요청 |
| `401` | 인증 필요 |
| `403` | 권한 없음 |
| `404` | 리소스 없음 |
| `422` | 유효성 검사 실패 |
| `500` | 서버 내부 오류 |
