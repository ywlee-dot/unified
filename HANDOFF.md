# HANDOFF

## Current [1772770565]
- **Task**: 평가편람 HWPX 파싱 → RAG 인제스트 파이프라인 구축
- **Completed**:
  - HWPX(한글) 파일 파싱 스크립트 작성 (`parse_hwpx.py`) — ZIP/XML 구조 분석, 평가항목 자동 추출
  - 평가편람 구조를 2개 평가 체계로 정확히 분리 (공공데이터 100점 + 데이터기반행정 100점)
  - 관리체계 영역을 공공데이터(7점)와 데이터기반행정(5점)으로 분리
  - 21개 평가항목 JSON 생성 → Gemini 임베딩 → Pinecone v2 네임스페이스에 인제스트
  - 고아 벡터(구 management_01~03) 삭제, 최종 21개 벡터 확인
- **Next Steps**:
  - RAG 평가 엔진(evaluation_engine.py)에서 새 JSON 구조(evaluation_type, area_score) 반영
  - 프론트엔드 평가 페이지에서 평가 유형 선택(공공데이터/데이터기반행정) UI 추가
  - 평가 결과에 영역별 소계 표시 (개방·활용 48점, 품질 45점 등)
- **Blockers**: None
- **Related Files**:
  - backend/app/projects/evaluation_rag/scripts/parse_hwpx.py (HWPX 파싱)
  - backend/app/projects/evaluation_rag/scripts/ingest_evaluation_items.py (Pinecone 인제스트)
  - backend/app/projects/evaluation_rag/data/evaluation_items.json (생성된 마스터 데이터)
  - backend/app/projects/evaluation_rag/data/1. 2025년 공공데이터 제공 및 데이터기반행정 평가편람(수정본).hwpx (원본)

## Past 1 [1772674813]
- **Task**: 정부뉴스 크롤링 프로젝트 디버깅 + 프론트엔드 컨테이너 수정
- **Completed**: API URL 중복 버그 수정, Dockerfile dev 타겟 추가, gov-news-crawler 시드 데이터 투입
- **Note**: frontend Dockerfile dev target, docker-compose frontend target: dev

## Past 2 [1772596860]
- **Task**: n8n 콜백 패턴 E2E 완성 + summarize 프로젝트 + 가이드 작성
- **Completed**: Alembic 마이그레이션, summarize 프로젝트 생성, Dockerfile에 자동 마이그레이션 추가, n8n E2E 테스트 성공
- **Note**: commit fcd19a2, fd8eaea
