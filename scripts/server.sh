#!/usr/bin/env bash
# Local helper — GitHub Actions workflow_dispatch로 서버 조회 실행
# (OCI 콘솔 접속이 안 될 때 GitHub Actions 경유로 서버 상태/로그/DB 확인)
#
# 사용 예:
#   ./scripts/server.sh status
#   ./scripts/server.sh logs backend 500 "bid_monitor|scheduler"
#   ./scripts/server.sh bid keywords
#   ./scripts/server.sh bid all 100
#
# 필요: gh CLI (이미 설치됨), production 브랜치에 workflow 파일 merge되어 있어야 함

set -euo pipefail

REPO="ywlee-dot/unified"
REF="production"

usage() {
  cat <<EOF
Usage:
  $0 status
  $0 logs <service> [lines] [grep]
       service = backend | frontend | n8n | db | nginx
       lines   = 숫자 (기본 500)
       grep    = 정규식 필터 (선택)
  $0 bid <action> [limit]
       action = keywords | notices_recent | alerts_recent | runs_recent | stats | all
       limit  = 숫자 (기본 50)
  $0 watch                # 가장 최근 실행 결과 스트리밍
EOF
  exit 1
}

run_and_watch() {
  local workflow="$1"; shift
  local args=("$@")
  echo ">> Triggering $workflow on $REPO@$REF"
  gh workflow run "$workflow" --repo "$REPO" --ref "$REF" "${args[@]}"
  sleep 3
  local run_id
  run_id=$(gh run list --repo "$REPO" --workflow "$workflow" --limit 1 --json databaseId -q '.[0].databaseId')
  echo ">> Watching run $run_id"
  gh run watch "$run_id" --repo "$REPO" --exit-status || true
  echo
  echo ">> View log:"
  gh run view "$run_id" --repo "$REPO" --log || true
}

cmd=${1:-}; shift || true
case "$cmd" in
  status)
    run_and_watch "server-status.yml"
    ;;
  logs)
    svc=${1:-backend}
    lines=${2:-500}
    grep_filter=${3:-}
    run_and_watch "server-logs.yml" \
      -f service="$svc" -f lines="$lines" -f grep="$grep_filter"
    ;;
  bid)
    action=${1:-all}
    limit=${2:-50}
    run_and_watch "bid-monitor-inspect.yml" \
      -f action="$action" -f limit="$limit"
    ;;
  watch)
    run_id=$(gh run list --repo "$REPO" --limit 1 --json databaseId -q '.[0].databaseId')
    gh run view "$run_id" --repo "$REPO" --log
    ;;
  *)
    usage
    ;;
esac
