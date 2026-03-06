# HANDOFF

## Current [1772784936]
- **Task**: 아키텍처 다이어그램 레이어 확장 — 파이프라인 노드를 아키텍처 swim lane 안에 배치
- **Completed**:
  - LayerGroupNode 컴포넌트 신규 생성 (Frontend/Backend/External/Data 4가지 스타일)
  - PipelineNodeCard에 Top/Bottom 핸들 추가 (cross-layer 엣지용) + techStack 태그 표시
  - makeLayerGroup / makeLayerNode 헬퍼 함수 추가
  - dataset-summary 프로젝트를 3개 레이어 그룹 + 5개 파이프라인 노드 구조로 재구성
  - PipelineFlow에 layerGroup 노드 타입 등록
  - TypeScript 빌드 통과 확인
- **Next Steps**:
  - 브라우저에서 dataset-summary 레이어 다이어그램 시각 확인 및 레이아웃 조정
  - 나머지 8개 프로젝트에 동일한 레이어 구조 적용 확장
  - Data Layer (PostgreSQL/Redis) 포함하는 프로젝트에 4번째 레이어 추가
  - 변경사항 커밋
- **Blockers**: None
- **Related Files**:
  - frontend/src/components/architecture/LayerGroupNode.tsx
  - frontend/src/components/architecture/PipelineNodeCard.tsx
  - frontend/src/components/architecture/PipelineFlow.tsx
  - frontend/src/lib/pipeline-data.ts

## Past 1 [1772780736]
- **Task**: 아키텍처 페이지 React Flow E2E 파이프라인 마이그레이션
- **Completed**: 기존 6탭 인프라 다이어그램 삭제, React Flow 9개 프로젝트 파이프라인 구현, 5가지 노드 타입 + 런타임 배지, SSR guard, Sidebar/BreadcrumbNav 대응
- **Note**: commit f77f25a

## Past 2 [1772775588]
- **Task**: 평가편람 RAG 평가 엔진 및 프론트엔드 - 새 JSON 구조(evaluation_type, area_score) 반영
- **Completed**: evaluation_type 필터링, management 카테고리 분리, 항목별 가변 배점, 배치 처리, 프론트엔드 평가 유형 선택 UI/AreaSubtotals/ItemScoreBar
- **Note**: commit 9571581
