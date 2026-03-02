#!/usr/bin/env bash
# health_check.sh - 통합 워크스페이스 서비스 헬스체크
#
# 사용법: ./scripts/health_check.sh
# 종료코드: 0 = 모두 정상, 1 = 하나 이상 실패

set -euo pipefail

# ---------------------------------------------------------------------------
# 색상 정의
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# 결과 추적
# ---------------------------------------------------------------------------
FAILED=0

check_ok() {
    echo -e "${GREEN}[OK]${NC}   $1"
}

check_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED=$((FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# ---------------------------------------------------------------------------
# 헬스체크 함수
# ---------------------------------------------------------------------------

check_backend() {
    local url="http://localhost:8000/api/health"
    local label="Backend (FastAPI :8000)"
    if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
        check_ok "$label"
    else
        check_fail "$label - $url 응답 없음"
    fi
}

check_frontend() {
    local url="http://localhost:3000"
    local label="Frontend (Next.js :3000)"
    if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
        check_ok "$label"
    else
        check_fail "$label - $url 응답 없음"
    fi
}

check_postgres() {
    local label="PostgreSQL (:5432)"
    # docker compose 환경에서 pg_isready 사용
    if command -v pg_isready > /dev/null 2>&1; then
        if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
            check_ok "$label"
        else
            check_fail "$label - pg_isready 실패"
        fi
    elif docker compose ps db 2>/dev/null | grep -q "healthy\|running\|Up"; then
        check_ok "$label (docker compose 상태 확인)"
    elif docker ps --filter "name=db" --filter "status=running" --format "{{.Names}}" 2>/dev/null | grep -q "db"; then
        check_ok "$label (컨테이너 실행 중)"
    else
        check_fail "$label - 상태 확인 불가"
    fi
}

check_redis() {
    local label="Redis (:6379)"
    if command -v redis-cli > /dev/null 2>&1; then
        if redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q "PONG"; then
            check_ok "$label"
        else
            check_fail "$label - redis-cli ping 실패"
        fi
    elif docker compose ps redis 2>/dev/null | grep -q "healthy\|running\|Up"; then
        check_ok "$label (docker compose 상태 확인)"
    elif docker ps --filter "name=redis" --filter "status=running" --format "{{.Names}}" 2>/dev/null | grep -q "redis"; then
        check_ok "$label (컨테이너 실행 중)"
    else
        check_fail "$label - 상태 확인 불가"
    fi
}

check_n8n() {
    local url="http://localhost:5678/healthz"
    local label="n8n (:5678)"
    if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
        check_ok "$label"
    else
        # /healthz 가 없는 버전을 위한 폴백
        if curl -sf --max-time 5 "http://localhost:5678/" > /dev/null 2>&1; then
            check_ok "$label (/ 폴백)"
        else
            check_fail "$label - $url 응답 없음"
        fi
    fi
}

# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------

echo "============================================"
echo " 통합 워크스페이스 헬스체크"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

check_backend
check_frontend
check_postgres
check_redis
check_n8n

echo ""
echo "============================================"

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}모든 서비스 정상${NC} (5/5)"
    exit 0
else
    echo -e "${RED}${FAILED}개 서비스 장애 감지${NC} ($((5 - FAILED))/5 정상)"
    exit 1
fi
