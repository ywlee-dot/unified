# 새 프로젝트 추가 가이드

> 통합 워크스페이스에 새 프로젝트 모듈을 추가하는 단계별 가이드입니다.

---

## 사전 조건

- Docker Compose 환경이 실행 중이어야 합니다 (`docker compose up -d`)
- 백엔드와 프론트엔드가 정상 기동되어 있어야 합니다
- `scripts/health_check.sh` 실행 시 모든 서비스가 OK 상태여야 합니다

---

## 방법 1: 자동 scaffold 스크립트 사용 (권장)

### 1단계: create_project.sh 실행

```bash
# 표준 프로젝트 (DB 모델 포함)
./scripts/create_project.sh <slug> "<표시 이름>" standard

# n8n 워크플로우 프로젝트
./scripts/create_project.sh <slug> "<표시 이름>" n8n
```

예시:

```bash
# 표준 프로젝트
./scripts/create_project.sh user-manager "사용자 관리" standard

# n8n 프로젝트
./scripts/create_project.sh email-sender "이메일 발송기" n8n
```

스크립트가 생성하는 파일:

```
backend/app/projects/{module_name}/
├── __init__.py
├── manifest.py
├── router.py
├── schemas.py
├── service.py
├── dummy_data.py
└── models.py        # standard 타입만

frontend/src/app/projects/{slug}/
└── page.tsx
```

### 2단계: 레지스트리 등록 확인

스크립트 실행 후 백엔드를 재시작하면 레지스트리가 자동으로 새 프로젝트를 탐색합니다.

```bash
docker compose restart backend
```

등록 확인:

```bash
curl http://localhost:8000/api/registry/projects | python3 -m json.tool
```

응답에 새 프로젝트 슬러그가 포함되어 있으면 성공입니다.

---

## 방법 2: 수동 추가

### 백엔드 모듈 추가

#### 1단계: 디렉토리 생성

```bash
mkdir -p backend/app/projects/{module_name}
```

슬러그의 하이픈을 언더스코어로 변경합니다 (예: `my-project` → `my_project`).

#### 2단계: `__init__.py` 생성

```bash
touch backend/app/projects/{module_name}/__init__.py
```

#### 3단계: `manifest.py` 작성

```python
# backend/app/projects/{module_name}/manifest.py
from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="my-project",              # URL에 사용되는 슬러그
    name="내 프로젝트",              # 사이드바/대시보드 표시 이름
    description="프로젝트 설명",
    version="1.0.0",
    project_type="standard",        # "standard" 또는 "n8n"
    icon="folder",                  # 아이콘 이름 (lucide-react 기준)
    color="#3B82F6",                # 테마 색상 (hex)
    enabled=True,
    router_module="app.projects.my_project.router",
)
```

n8n 타입의 경우 `n8n_config`를 추가합니다:

```python
manifest = ProjectManifest(
    ...
    project_type="n8n",
    router_module="app.projects.my_project.router",
    n8n_config={
        "webhook_path": "/webhook/my-project",
        "workflows": [
            {"id": "main-workflow", "name": "메인 워크플로우", "trigger_type": "manual"},
        ],
    },
)
```

#### 4단계: `schemas.py` 작성

```python
# backend/app/projects/{module_name}/schemas.py
from datetime import datetime
from pydantic import BaseModel


class MyItem(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class MyItemCreate(BaseModel):
    name: str
```

#### 5단계: `models.py` 작성 (standard 타입만)

```python
# backend/app/projects/{module_name}/models.py
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class MyItem(BaseEntity):
    __tablename__ = "my_project_items"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

#### 6단계: `dummy_data.py` 작성

```python
# backend/app/projects/{module_name}/dummy_data.py
from datetime import datetime, timezone
import uuid


def get_dummy_items() -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "id": str(uuid.uuid4()),
            "name": f"샘플 항목 {i+1}",
            "status": "active",
            "created_at": now,
        }
        for i in range(5)
    ]


def get_dummy_stats() -> dict:
    return {
        "total_items": 5,
        "active_items": 5,
    }
```

#### 7단계: `service.py` 작성

```python
# backend/app/projects/{module_name}/service.py
from sqlalchemy.ext.asyncio import AsyncSession
from .dummy_data import get_dummy_items, get_dummy_stats


class MyProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_items(self) -> list[dict]:
        # TODO: DB 조회로 교체
        return get_dummy_items()

    async def get_stats(self) -> dict:
        return get_dummy_stats()
```

#### 8단계: `router.py` 작성

```python
# backend/app/projects/{module_name}/router.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.shared.schemas.common import ApiResponse
from .service import MyProjectService

router = APIRouter()


@router.get("/items", summary="항목 목록")
async def get_items(db: AsyncSession = Depends(get_db)):
    service = MyProjectService(db)
    items = await service.get_items()
    return ApiResponse(success=True, data=items)


@router.get("/stats", summary="통계")
async def get_stats(db: AsyncSession = Depends(get_db)):
    service = MyProjectService(db)
    stats = await service.get_stats()
    return ApiResponse(success=True, data=stats)
```

### 프론트엔드 페이지 추가

#### 1단계: 디렉토리 생성

```bash
mkdir -p frontend/src/app/projects/{slug}
```

#### 2단계: `page.tsx` 작성

```tsx
// frontend/src/app/projects/{slug}/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function MyProjectPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects/my-project/stats')
      .then(r => r.json())
      .then(json => setData(json.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">내 프로젝트</h1>
      <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

---

## 데이터베이스 마이그레이션 (standard 타입)

새 모델을 추가한 경우 Alembic 마이그레이션을 생성합니다.

```bash
# 마이그레이션 파일 자동 생성
docker compose exec backend alembic revision --autogenerate -m "add my_project tables"

# 마이그레이션 적용
docker compose exec backend alembic upgrade head
```

---

## 새 프로젝트 테스트

### 1. 백엔드 재시작

```bash
docker compose restart backend
```

### 2. 레지스트리 확인

```bash
curl http://localhost:8000/api/registry/projects
# 응답에 새 프로젝트 slug가 포함되어야 함
```

### 3. Swagger UI에서 API 확인

브라우저에서 접속: `http://localhost:8000/api/docs`

새 프로젝트의 엔드포인트가 표시되어야 합니다.

### 4. 프론트엔드 페이지 확인

브라우저에서 접속: `http://localhost:3000/projects/{slug}`

---

## 체크리스트

새 프로젝트 추가 완료 여부를 아래 항목으로 확인합니다.

### 백엔드

- [ ] `backend/app/projects/{module_name}/` 디렉토리 생성됨
- [ ] `__init__.py` 파일 존재
- [ ] `manifest.py` 작성 완료 (slug, name, description, project_type 설정)
- [ ] `router.py` 작성 완료 (최소 1개 엔드포인트)
- [ ] `schemas.py` 작성 완료
- [ ] `service.py` 작성 완료
- [ ] `dummy_data.py` 작성 완료
- [ ] `models.py` 작성 완료 (standard 타입만)
- [ ] Alembic 마이그레이션 생성 및 적용 (standard 타입만)

### 프론트엔드

- [ ] `frontend/src/app/projects/{slug}/page.tsx` 생성됨
- [ ] 페이지가 정상 렌더링됨 (빈 페이지 또는 오류 없음)

### 검증

- [ ] `docker compose restart backend` 후 오류 없음
- [ ] `GET /api/registry/projects` 응답에 새 슬러그 포함
- [ ] Swagger UI에서 새 프로젝트 엔드포인트 표시
- [ ] 브라우저에서 `/projects/{slug}` 접속 가능
- [ ] `scripts/health_check.sh` 전체 통과

---

## 문제 해결

### 레지스트리에 프로젝트가 나타나지 않는 경우

1. `manifest.py`에 `manifest` 변수가 정의되어 있는지 확인
2. `enabled=True`로 설정되어 있는지 확인
3. 백엔드 로그 확인: `docker compose logs backend`

### ImportError 발생 시

1. `router_module` 경로가 올바른지 확인
2. 모듈 내 Python 문법 오류가 없는지 확인
3. `__init__.py` 파일이 모든 디렉토리에 존재하는지 확인

### 프론트엔드 페이지 404

1. `frontend/src/app/projects/{slug}/page.tsx` 파일 경로의 슬러그가 올바른지 확인
2. 프론트엔드 개발 서버 재시작: `docker compose restart frontend`
