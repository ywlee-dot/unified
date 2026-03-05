# HANDOFF

## Current [1772674813]
- **Task**: 정부뉴스 크롤링 프로젝트 디버깅 + 프론트엔드 컨테이너 수정
- **Completed**:
  - 정부뉴스 크롤링(gov-news-crawler) 프론트엔드 API URL 중복 버그 수정 (`/api/api/...` → `/api/...`) - 3개 파일
  - 프론트엔드 Dockerfile에 `dev` 타겟 추가 (`next: not found` 해결)
  - docker-compose.yml에서 frontend `target: dev` 지정 및 `command` 제거
  - gov-news-crawler 시드 데이터 투입 (키워드 5건, 소스 6건, 기사 10건, 점수 14건, 크롤 이력 3건)
- **Next Steps**:
  - 백엔드 헬스체크 수정 (curl 없이 동작하도록)
  - 다른 프로젝트 프론트엔드 페이지에도 동일한 API URL 중복 문제 있는지 점검
  - summarize 프로젝트 프론트엔드 페이지 구현 (백엔드만 존재)
- **Blockers**: None
- **Related Files**:
  - frontend/Dockerfile (dev 타겟 추가)
  - docker-compose.yml (frontend target: dev)
  - frontend/src/app/projects/gov-news-crawler/page.tsx (URL 수정)
  - frontend/src/app/projects/gov-news-crawler/keywords/page.tsx (URL 수정)
  - frontend/src/app/projects/gov-news-crawler/search/page.tsx (URL 수정)

## Past 1 [1772596860]
- **Task**: n8n 콜백 패턴 E2E 완성 + summarize 프로젝트 + 가이드 작성
- **Completed**: Alembic 마이그레이션, summarize 프로젝트 생성, Dockerfile에 자동 마이그레이션 추가, n8n E2E 테스트 성공, 가이드 작성
- **Note**: commit fcd19a2, fd8eaea

## Past 2 [1772528560]
- **Task**: n8n 콜백 패턴 구현 (폴링 → 콜백 방식 전환)
- **Completed**: N8nExecutionModel, 콜백 엔드포인트, n8n_client 간소화, report_generator/data_pipeline DB 기반 전환
- **Note**: commit d0e602e, 1fd4f24
