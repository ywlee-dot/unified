# HANDOFF

## Current [1772780736]
- **Task**: 아키텍처 페이지 React Flow E2E 파이프라인 마이그레이션
- **Completed**:
  - 기존 6탭 인프라 중심 다이어그램 완전 삭제 (6개 파일/디렉토리)
  - React Flow (@xyflow/react) 설치 및 9개 프로젝트별 E2E 파이프라인 다이어그램 구현
  - 5가지 커스텀 노드 타입 (input/process/service/storage/output) + 런타임 배지
  - 단일 /architecture?project=<slug> 페이지 + 프로젝트 탭 전환
  - SSR guard (next/dynamic + ssr: false), Suspense 래핑, CSS import
  - Sidebar isActive 로직 query param 대응, BreadcrumbNav 프로젝트명 표시
  - next.config.ts redirects() 추가 (/architecture/:slug → ?project=:slug)
  - evaluation-rag 이중 흐름 (인제스트 + 평가), open-data-analyzer 5단계 파이프라인
  - evaluation-rag/page.tsx evalType 타입 에러 수정 (기존 버그)
  - Ralplan 합의 기획 (Planner → Architect → Critic → 수정 → 재승인)
- **Next Steps**:
  - 변경사항 커밋
  - 실제 브라우저에서 9개 프로젝트 탭 전환 및 다이어그램 확인
  - 인프라 레인을 React Flow group node로 변경 검토 (현재는 정적 HTML 바)
  - 모바일 반응형 확인 및 조정
- **Blockers**: None
- **Related Files**:
  - frontend/src/lib/pipeline-data.ts
  - frontend/src/components/architecture/PipelineFlow.tsx
  - frontend/src/components/architecture/PipelineNodeCard.tsx
  - frontend/src/components/architecture/ProjectTabNav.tsx
  - frontend/src/app/architecture/page.tsx
  - frontend/src/components/layout/Sidebar.tsx
  - frontend/src/components/layout/BreadcrumbNav.tsx
  - frontend/next.config.ts
  - .omc/plans/architecture-reactflow-migration.md

## Past 1 [1772775588]
- **Task**: 평가편람 RAG 평가 엔진 및 프론트엔드 - 새 JSON 구조(evaluation_type, area_score) 반영
- **Completed**: evaluation_type 필터링, management 카테고리 분리, 항목별 가변 배점, 배치 처리, 프론트엔드 평가 유형 선택 UI/AreaSubtotals/ItemScoreBar
- **Note**: commit 9571581

## Past 2 [1772770565]
- **Task**: 평가편람 HWPX 파싱 → RAG 인제스트 파이프라인 구축
- **Completed**: HWPX 파싱 스크립트, 평가항목 21개 JSON 생성, Gemini 임베딩 → Pinecone v2 인제스트, 고아 벡터 삭제
- **Note**: commit 9d03c2f
