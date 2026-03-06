# HANDOFF

## Current [1772775588]
- **Task**: 평가편람 RAG 평가 엔진 및 프론트엔드 - 새 JSON 구조(evaluation_type, area_score) 반영
- **Completed**:
  - 평가 엔진에서 evaluation_type(public_data/data_admin) 필터링 지원
  - management 카테고리를 management_pub(7점) + management_dba(5점)로 분리
  - 항목별 실제 max_score 지원 (10점 고정 → 항목별 가변 배점)
  - 배치 처리 (8개 초과 시 자동 분할) 및 결과 병합
  - 프론트엔드: 평가 유형 선택 UI (전체/공공데이터/데이터기반행정)
  - 프론트엔드: AreaSubtotals 컴포넌트 (영역별 소계 표시)
  - 프론트엔드: ItemScoreBar (항목별 점수 바 + 상세 접기/펼치기)
  - 프론트엔드: 평가 기준표 탭에서 evaluation_type별 그룹핑 표시
  - stats API categories를 새 구조(management_pub/management_dba)로 업데이트
- **Next Steps**:
  - 변경사항 커밋 및 배포
  - 실제 평가 실행 테스트 (공공데이터/데이터기반행정 각각)
  - 평가 이력 상세 보기 기능 (히스토리 테이블 행 클릭 시 상세 결과 표시)
- **Blockers**: None
- **Related Files**:
  - backend/app/projects/evaluation_rag/core/evaluation_engine.py
  - backend/app/projects/evaluation_rag/core/prompt_builder.py
  - backend/app/projects/evaluation_rag/core/query_processor.py
  - backend/app/projects/evaluation_rag/core/result_parser.py
  - backend/app/projects/evaluation_rag/router.py
  - backend/app/projects/evaluation_rag/schemas.py
  - backend/app/projects/evaluation_rag/service.py
  - frontend/src/app/projects/evaluation-rag/page.tsx

## Past 1 [1772770565]
- **Task**: 평가편람 HWPX 파싱 → RAG 인제스트 파이프라인 구축
- **Completed**: HWPX 파싱 스크립트, 평가항목 21개 JSON 생성, Gemini 임베딩 → Pinecone v2 인제스트, 고아 벡터 삭제
- **Note**: commit 9d03c2f

## Past 2 [1772674813]
- **Task**: 정부뉴스 크롤링 프로젝트 디버깅 + 프론트엔드 컨테이너 수정
- **Completed**: API URL 중복 버그 수정, Dockerfile dev 타겟 추가, gov-news-crawler 시드 데이터 투입
- **Note**: frontend Dockerfile dev target, docker-compose frontend target: dev
