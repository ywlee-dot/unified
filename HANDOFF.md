# HANDOFF

## Current [1773998834]
- **Task**: 사이드바 하드코딩 전환 + 5개 프로젝트 페이지 UX 개선 (서비스 설명/사용법 가이드 추가)
- **Completed**:
  - Sidebar를 API 기반 → 하드코딩으로 전환, useProjects 의존성 제거
  - 카테고리 3분류 적용: 개방(3) / 품질(3) / 데이터기반행정(3)
  - 사이드바 slug와 실제 페이지 경로 불일치 수정 (civil-best-practices→best-practice-search, business-rules→business-rule-gen, ai-adoption-report→ai-case-report)
  - 5개 n8n 프로젝트 페이지 UX 전면 개선 (best-practice-search, test1, business-rule-gen, ai-case-report, effort-public-data)
    - 각 페이지: 헤더 → 파일 업로드 → 실행 → 결과 → 서비스 설명 → 작동 방식(4단계) → 상세 안내(접이식)
    - n8n JSON 워크플로우 분석 기반으로 서비스 설명/AI 선별 기준/필수 컬럼/소요 시간 등 안내
  - layout.tsx에 suppressHydrationWarning 추가 (브라우저 확장 hydration 에러 대응)
- **Next Steps**:
  - 아키텍처 페이지 리팩토링: pipeline-data.ts를 새 카테고리에 맞게 재정리
  - 삭제된 프로젝트(report-generator, data-pipeline, summarize) 제거
  - 새 프로젝트(best-practice-search, business-rule-gen, ai-case-report) 파이프라인 추가
  - n8n JSON 분석 결과를 반영하여 실제 워크플로우에 맞는 노드/엣지로 교체
  - 인증 문제 해결 (DB 유저 admin@test.com 비밀번호 리셋 필요)
- **Blockers**: 로그인 불가 (DB에 admin@test.com 유저 있으나 비밀번호 불명, 프론트에서 admin@tucon.com으로 시도)
- **Related Files**:
  - frontend/src/components/layout/Sidebar.tsx
  - frontend/src/app/(main)/projects/best-practice-search/page.tsx
  - frontend/src/app/(main)/projects/test1/page.tsx
  - frontend/src/app/(main)/projects/business-rule-gen/page.tsx
  - frontend/src/app/(main)/projects/ai-case-report/page.tsx
  - frontend/src/app/(main)/projects/effort-public-data/page.tsx
  - frontend/src/app/layout.tsx
  - frontend/src/lib/pipeline-data.ts

## Past 1 [1772784936]
- **Task**: 아키텍처 다이어그램 레이어 확장 — 파이프라인 노드를 아키텍처 swim lane 안에 배치
- **Completed**: LayerGroupNode 생성, PipelineNodeCard 핸들/techStack 추가, dataset-summary 3레이어 구조 재구성, 빌드 통과
- **Note**: 나머지 8개 프로젝트 레이어 확장 미완

## Past 2 [1772780736]
- **Task**: 아키텍처 페이지 React Flow E2E 파이프라인 마이그레이션
- **Completed**: 기존 6탭 인프라 다이어그램 삭제, React Flow 9개 프로젝트 파이프라인 구현, 5가지 노드 타입 + 런타임 배지
- **Note**: commit f77f25a
