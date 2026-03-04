# HANDOFF

## Current [1772596860]
- **Task**: n8n 콜백 패턴 E2E 완성 + summarize 프로젝트 + 가이드 작성
- **Completed**:
  - Alembic 마이그레이션 생성/적용 (n8n_executions 테이블)
  - summarize 프로젝트 생성 (backend/app/projects/summarize/)
  - Render 배포 및 환경변수 설정 (N8N_WEBHOOK_BASE, N8N_CALLBACK_SECRET)
  - Dockerfile에 alembic upgrade head 추가 (배포 시 자동 마이그레이션)
  - n8n Cloud 워크플로우 연결 및 E2E 테스트 성공 (trigger → callback → DB)
  - tracking_id 생성 로직 추가 (n8n Immediately 모드 대응)
  - n8n 워크플로우 연동 가이드 HTML 작성
- **Next Steps**:
  - 프론트엔드에서 summarize 프로젝트 페이지 구현
  - report_generator, data_pipeline도 동일하게 tracking_id 방식 적용
  - 프로젝트별 다른 n8n 인스턴스 지원 (N8N_WEBHOOK_BASE 분리)
- **Blockers**: None
- **Related Files**:
  - backend/app/projects/summarize/ (NEW)
  - backend/Dockerfile
  - backend/alembic/script.py.mako (NEW)
  - backend/alembic/versions/f997e804f4eb_add_n8n_executions_table.py (NEW)
  - docs/n8n-setup-guide.html (NEW)

## Past 1 [1772528560]
- **Task**: n8n 콜백 패턴 구현 (폴링 → 콜백 방식 전환)
- **Completed**: N8nExecutionModel, 콜백 엔드포인트, n8n_client 간소화, report_generator/data_pipeline DB 기반 전환
- **Note**: commit d0e602e, 1fd4f24
