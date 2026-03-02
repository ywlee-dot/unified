#!/usr/bin/env bash
# create_project.sh - 새 프로젝트 scaffold 자동 생성 스크립트
#
# 사용법:
#   ./scripts/create_project.sh <slug> <display_name> <type>
#
# 인수:
#   slug         - 프로젝트 슬러그 (예: my-project)
#   display_name - 표시 이름 (예: "내 프로젝트")
#   type         - 프로젝트 타입: standard | n8n
#
# 예시:
#   ./scripts/create_project.sh my-project "내 프로젝트" standard
#   ./scripts/create_project.sh data-export "데이터 내보내기" n8n

set -euo pipefail

# ---------------------------------------------------------------------------
# 인수 검증
# ---------------------------------------------------------------------------

if [ $# -ne 3 ]; then
    echo "사용법: $0 <slug> <display_name> <type>"
    echo ""
    echo "  slug         프로젝트 슬러그 (소문자, 하이픈 허용. 예: my-project)"
    echo "  display_name 한글 표시 이름 (예: \"내 프로젝트\")"
    echo "  type         standard | n8n"
    echo ""
    echo "예시:"
    echo "  $0 my-project \"내 프로젝트\" standard"
    echo "  $0 data-export \"데이터 내보내기\" n8n"
    exit 1
fi

SLUG="$1"
DISPLAY_NAME="$2"
PROJECT_TYPE="$3"

# 슬러그 유효성 검사
if ! echo "$SLUG" | grep -qE '^[a-z][a-z0-9-]*$'; then
    echo "오류: 슬러그는 소문자 영문자로 시작하고, 소문자/숫자/하이픈만 포함해야 합니다."
    exit 1
fi

# 타입 유효성 검사
if [ "$PROJECT_TYPE" != "standard" ] && [ "$PROJECT_TYPE" != "n8n" ]; then
    echo "오류: type은 'standard' 또는 'n8n' 이어야 합니다."
    exit 1
fi

# 슬러그 -> Python 모듈명 변환 (하이픈 -> 언더스코어)
MODULE_NAME="${SLUG//-/_}"

# ---------------------------------------------------------------------------
# 경로 설정
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend/app/projects/$MODULE_NAME"
FRONTEND_DIR="$ROOT_DIR/frontend/src/app/projects/$SLUG"

echo "============================================"
echo " 새 프로젝트 생성: $DISPLAY_NAME"
echo " 슬러그: $SLUG"
echo " 모듈명: $MODULE_NAME"
echo " 타입:   $PROJECT_TYPE"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# 디렉토리 생성
# ---------------------------------------------------------------------------

echo "[1/3] 백엔드 디렉토리 생성: $BACKEND_DIR"
mkdir -p "$BACKEND_DIR"

echo "[2/3] 프론트엔드 디렉토리 생성: $FRONTEND_DIR"
mkdir -p "$FRONTEND_DIR"

# ---------------------------------------------------------------------------
# 백엔드 파일 생성
# ---------------------------------------------------------------------------

echo "[3/3] 파일 생성 중..."

# __init__.py
cat > "$BACKEND_DIR/__init__.py" << 'PYEOF'
PYEOF

# manifest.py
if [ "$PROJECT_TYPE" = "n8n" ]; then
cat > "$BACKEND_DIR/manifest.py" << PYEOF
from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="${SLUG}",
    name="${DISPLAY_NAME}",
    description="${DISPLAY_NAME} 프로젝트 - n8n 워크플로우 연동",
    version="1.0.0",
    project_type="n8n",
    icon="workflow",
    color="#10B981",
    enabled=True,
    router_module="app.projects.${MODULE_NAME}.router",
    n8n_config={
        "webhook_path": "/webhook/${SLUG}",
        "workflows": [
            {"id": "${SLUG}-main", "name": "${DISPLAY_NAME} 실행", "trigger_type": "manual"},
        ],
    },
)
PYEOF
else
cat > "$BACKEND_DIR/manifest.py" << PYEOF
from app.registry.project_registry import ProjectManifest

manifest = ProjectManifest(
    slug="${SLUG}",
    name="${DISPLAY_NAME}",
    description="${DISPLAY_NAME} 프로젝트",
    version="1.0.0",
    project_type="standard",
    icon="folder",
    color="#3B82F6",
    enabled=True,
    router_module="app.projects.${MODULE_NAME}.router",
)
PYEOF
fi

# schemas.py
cat > "$BACKEND_DIR/schemas.py" << PYEOF
"""
${DISPLAY_NAME} Pydantic 스키마
"""
from datetime import datetime
from pydantic import BaseModel


class ${MODULE_NAME^}Item(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ${MODULE_NAME^}ItemCreate(BaseModel):
    name: str


class ${MODULE_NAME^}Stats(BaseModel):
    total_items: int
    active_items: int
PYEOF

# service.py
if [ "$PROJECT_TYPE" = "n8n" ]; then
cat > "$BACKEND_DIR/service.py" << PYEOF
"""
${DISPLAY_NAME} 서비스 (n8n 연동)
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.services.n8n_client import N8nClient
from app.config import settings
from .dummy_data import get_dummy_runs


class ${MODULE_NAME^}Service:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.n8n = N8nClient(
            base_url=settings.N8N_BASE_URL,
            webhook_base=settings.N8N_WEBHOOK_BASE,
        )

    async def get_runs(self) -> list[dict]:
        return get_dummy_runs()

    async def trigger_workflow(self, workflow_id: str, parameters: dict) -> dict:
        run_id = str(uuid.uuid4())
        # TODO: 실제 n8n 웹훅 호출로 교체
        # await self.n8n.trigger_webhook(f"/webhook/${SLUG}", parameters)
        return {
            "run_id": run_id,
            "status": "triggered",
            "message": f"워크플로우 '{workflow_id}' 실행이 요청되었습니다.",
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        }
PYEOF
else
cat > "$BACKEND_DIR/service.py" << PYEOF
"""
${DISPLAY_NAME} 서비스
"""
from sqlalchemy.ext.asyncio import AsyncSession

from .dummy_data import get_dummy_items, get_dummy_stats


class ${MODULE_NAME^}Service:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_items(self, page: int = 1, page_size: int = 20) -> dict:
        items = get_dummy_items()
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": items[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    async def get_stats(self) -> dict:
        return get_dummy_stats()
PYEOF
fi

# dummy_data.py
if [ "$PROJECT_TYPE" = "n8n" ]; then
cat > "$BACKEND_DIR/dummy_data.py" << PYEOF
"""
${DISPLAY_NAME} 더미 데이터
"""
from datetime import datetime, timezone


def get_dummy_runs() -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "run_id": "run-001",
            "workflow_id": "${SLUG}-main",
            "workflow_name": "${DISPLAY_NAME} 실행",
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
            "id": "${SLUG}-main",
            "name": "${DISPLAY_NAME} 실행",
            "description": "${DISPLAY_NAME} 워크플로우",
            "trigger_type": "manual",
            "status": "active",
            "last_run_at": None,
        },
    ]
PYEOF
else
cat > "$BACKEND_DIR/dummy_data.py" << PYEOF
"""
${DISPLAY_NAME} 더미 데이터
"""
from datetime import datetime, timezone
import uuid


def get_dummy_items() -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "id": str(uuid.uuid4()),
            "name": f"${DISPLAY_NAME} 항목 {i+1}",
            "status": "active" if i % 3 != 2 else "inactive",
            "created_at": now,
        }
        for i in range(10)
    ]


def get_dummy_stats() -> dict:
    return {
        "total_items": 10,
        "active_items": 7,
    }
PYEOF
fi

# router.py
if [ "$PROJECT_TYPE" = "n8n" ]; then
cat > "$BACKEND_DIR/router.py" << PYEOF
"""
${DISPLAY_NAME} API 라우터 (n8n)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.shared.schemas.common import ApiResponse
from .service import ${MODULE_NAME^}Service
from .dummy_data import get_dummy_workflows

router = APIRouter()


@router.get("/workflows", summary="워크플로우 목록")
async def get_workflows():
    return ApiResponse(success=True, data=get_dummy_workflows())


@router.post("/trigger/{workflow_id}", summary="워크플로우 트리거")
async def trigger_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = ${MODULE_NAME^}Service(db)
    result = await service.trigger_workflow(workflow_id, {})
    return ApiResponse(success=True, data=result)


@router.get("/runs", summary="실행 이력")
async def get_runs(db: AsyncSession = Depends(get_db)):
    service = ${MODULE_NAME^}Service(db)
    runs = await service.get_runs()
    return ApiResponse(success=True, data=runs)
PYEOF
else
cat > "$BACKEND_DIR/router.py" << PYEOF
"""
${DISPLAY_NAME} API 라우터
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.shared.schemas.common import ApiResponse, PaginatedResponse
from .service import ${MODULE_NAME^}Service

router = APIRouter()


@router.get("/items", summary="항목 목록")
async def get_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    service = ${MODULE_NAME^}Service(db)
    result = await service.get_items(page=page, page_size=page_size)
    return ApiResponse(success=True, data=result)


@router.get("/stats", summary="통계 요약")
async def get_stats(db: AsyncSession = Depends(get_db)):
    service = ${MODULE_NAME^}Service(db)
    stats = await service.get_stats()
    return ApiResponse(success=True, data=stats)
PYEOF
fi

# models.py (standard 타입만)
if [ "$PROJECT_TYPE" = "standard" ]; then
cat > "$BACKEND_DIR/models.py" << PYEOF
"""
${DISPLAY_NAME} SQLAlchemy 모델
"""
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class ${MODULE_NAME^}Item(BaseEntity):
    __tablename__ = "${MODULE_NAME}_items"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
PYEOF
fi

# ---------------------------------------------------------------------------
# 프론트엔드 파일 생성
# ---------------------------------------------------------------------------

cat > "$FRONTEND_DIR/page.tsx" << TSEOF
/**
 * ${DISPLAY_NAME} 메인 페이지
 */
'use client';

import { useState, useEffect } from 'react';

interface StatsData {
  total_items?: number;
  active_items?: number;
  [key: string]: unknown;
}

export default function ${MODULE_NAME^}Page() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/projects/${SLUG}/stats');
        if (!res.ok) throw new Error('데이터 로드 실패');
        const json = await res.json();
        setStats(json.data ?? json);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          오류: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">${DISPLAY_NAME}</h1>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <p className="text-sm text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {typeof value === 'number' ? value.toLocaleString() : String(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <p className="text-gray-500 text-sm">
          TODO: ${DISPLAY_NAME} 주요 기능을 여기에 구현하세요.
        </p>
      </div>
    </div>
  );
}
TSEOF

# ---------------------------------------------------------------------------
# 완료 메시지
# ---------------------------------------------------------------------------

echo ""
echo "============================================"
echo " 파일 생성 완료!"
echo "============================================"
echo ""
echo "생성된 파일:"
echo ""
echo "  백엔드 (backend/app/projects/$MODULE_NAME/):"
echo "    - __init__.py"
echo "    - manifest.py"
echo "    - router.py"
echo "    - schemas.py"
echo "    - service.py"
echo "    - dummy_data.py"
if [ "$PROJECT_TYPE" = "standard" ]; then
echo "    - models.py"
fi
echo ""
echo "  프론트엔드 (frontend/src/app/projects/$SLUG/):"
echo "    - page.tsx"
echo ""
echo "============================================"
echo " 다음 단계"
echo "============================================"
echo ""
echo "1. 백엔드 레지스트리 등록 확인:"
echo "   backend/app/projects/__init__.py 에 '$MODULE_NAME' 임포트 추가"
echo ""
echo "2. manifest.py 내용 검토 및 수정:"
echo "   $BACKEND_DIR/manifest.py"
echo ""
if [ "$PROJECT_TYPE" = "standard" ]; then
echo "3. 데이터베이스 마이그레이션 생성:"
echo "   docker compose exec backend alembic revision --autogenerate -m \"add ${MODULE_NAME} tables\""
echo "   docker compose exec backend alembic upgrade head"
echo ""
echo "4. seed_data.py 에 더미 데이터 추가"
echo ""
fi
echo "5. 백엔드 재시작:"
echo "   docker compose restart backend"
echo ""
echo "6. API 확인:"
echo "   http://localhost:8000/api/docs#/${SLUG}"
echo ""
echo "7. 프론트엔드 페이지 확인:"
echo "   http://localhost:3000/projects/$SLUG"
echo ""
echo "자세한 내용은 docs/adding-new-project.md 를 참조하세요."
