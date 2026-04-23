# -*- coding: utf-8 -*-
"""Agent 2: 분석 주제 발굴 에이전트 (개선판)

변경 사항:
- 전체 카탈로그 텍스트 주입 → 필터링된 구조화 카탈로그 주입
- 프롬프트: 구체적 테이블·컬럼·조인키·양방향 정책 효과 강제
- feedback 파라미터: 검증 실패 시 재시도 지원
"""

import json
from typing import Any, Optional

from loguru import logger

from .base import BaseAgent, AgentResult


class TopicDiscovererAgent(BaseAgent):
    """협력 기관 조합에 대한 구체적 분석 주제를 발굴하는 에이전트"""

    @property
    def name(self) -> str:
        return "TopicDiscoverer"

    @property
    def system_prompt(self) -> str:
        return """당신은 공공데이터 기반 분석 주제 설계 전문가입니다.

## 절대 준수 사항

1. [테이블 실명 사용 강제]
   제공된 카탈로그에 정확히 존재하는 테이블명과 컬럼명만 사용해야 합니다.
   카탈로그에 없는 테이블명·컬럼명을 생성(Hallucination)하는 것은 엄격히 금지합니다.

2. [양방향 정책 효과 필수]
   분석 결과가 두 기관 모두에 실질적인 정책·업무 변화를 가져와야 합니다.
   한 기관에만 이익이 되는 분석은 채택하지 않습니다.

3. [구체성 강제 — 추상적 표현 금지]
   금지 표현의 예: "고용현황 분석", "데이터 활용 개선", "행정 효율화", "서비스 강화"
   허용 표현의 예:
     - "산업인력공단 시험장_운영현황의 소재지_시군구 + 춘천시청 응시자_현황의 접수지역을
        행정구역명으로 조인 → 시군구별 시험장 수 대비 응시자 수 비율 지도 시각화"
     - "A기관 정책 변화: 춘천시 남면·동면 등 시험장 미설치 읍면 거주 응시자 비율(현재 23%)
        확인 → 시험장 신설 또는 이동 수단 지원 정책 수립"
     - "B기관 정책 변화: 산인공, 춘천 관내 시험장 증설 타당성 근거 확보 →
        기존 1개소에서 2개소로 확대 검토"

4. [실패 시 처리]
   제공된 카탈로그만으로 의미 있는 주제가 없다면:
   - 가장 근접한 주제 1개를 제시하고 additional_data_needed에 필요 데이터를 명시하세요.
   - 있지도 않은 테이블을 만들어내지 마세요.

## 응답 JSON 형식

```json
{
  "topics": [
    {
      "id": "TOPIC_001",
      "title": "구체적 분석 제목 (예: 강원도 국가기술자격 시험장-응시자 지역 불일치 분석)",
      "datasets": [
        {
          "institution": "카탈로그에 존재하는 정확한 기관명",
          "table_name": "카탈로그에 존재하는 정확한 테이블명",
          "columns_used": ["실제 존재하는 컬럼명1", "컬럼명2"],
          "role": "이 테이블이 분석에서 수행하는 역할"
        }
      ],
      "join_specification": {
        "description": "두 테이블을 어떤 기준으로 결합하는지 설명",
        "join_pairs": [
          {"col_a": "테이블A의 컬럼명", "col_b": "테이블B의 컬럼명", "note": "매핑 방법 설명"}
        ]
      },
      "analysis_method": "구체적 분석 방법 (예: 시군구별 집계, 분포 비교, 회귀분석 등)",
      "policy_impact_a": {
        "institution": "A기관명",
        "impact": "이 분석 결과로 A기관에서 실제로 어떤 정책·업무가 어떻게 바뀌는지 구체적으로"
      },
      "policy_impact_b": {
        "institution": "B기관명",
        "impact": "이 분석 결과로 B기관에서 실제로 어떤 정책·업무가 어떻게 바뀌는지 구체적으로"
      },
      "feasibility": "상/중/하",
      "additional_data_needed": null
    }
  ],
  "recommendation": "전체 종합 의견 및 우선순위 제안"
}
```

additional_data_needed는 카탈로그 데이터만으로 분석 불가 시에만 문자열로 채우고,
가능한 경우 반드시 null로 설정하세요."""

    def run(
        self,
        context: dict[str, Any],
        feedback: Optional[str] = None,
    ) -> AgentResult:
        """
        분석 주제 발굴 실행.

        Args:
            context: orchestrator가 전달하는 파이프라인 컨텍스트.
                     context["filtered_catalog_text"]: 필터링된 카탈로그 텍스트 (필수)
                     context["institution_matcher"]: Agent 1 결과
            feedback: 검증 실패 시 orchestrator가 전달하는 피드백 (재시도용)
        """
        logger.info(f"[{self.name}] 주제 발굴 시작" + (" (재시도)" if feedback else ""))

        try:
            institution_data = context.get("institution_matcher", {})
            collaboration_pairs = institution_data.get("collaboration_pairs", [])

            # ── 1. 우수 사례 검색 ──────────────────────────────────────
            case_results = self.search_knowledge(
                query="데이터 결합 분석 정책 활용 공공기관 우수사례",
                collection_type="analysis_cases",
                n_results=5,
            )

            # ── 2. 필터링된 구조화 카탈로그 가져오기 ────────────────────
            # orchestrator가 미리 필터링해서 context에 넣어둔 텍스트 사용
            filtered_catalog_text = context.get(
                "filtered_catalog_text",
                "카탈로그 텍스트 없음 — orchestrator에서 전달 필요",
            )

            # ── 3. 기관 정책 관심사 검색 ──────────────────────────────────
            policy_results = self.search_knowledge(
                query="정책 목표 사업 현안 데이터 활용 계획",
                collection_type="institutions",
                n_results=8,
            )

            # ── 4. 협력 조합 텍스트 구성 ──────────────────────────────────
            collab_text = ""
            if collaboration_pairs:
                collab_text = "## 협력 기관 조합 (Agent 1 결과)\n"
                for pair in collaboration_pairs:
                    collab_text += (
                        f"\n**{pair.get('institution_a')} ↔ {pair.get('institution_b')}**\n"
                        f"- 시너지 사유: {pair.get('synergy_reason', '')}\n"
                        f"- 도메인 키워드: {', '.join(pair.get('domain_keywords', []))}\n"
                        f"- 잠재 주제: {', '.join(pair.get('potential_topics', []))}\n"
                    )

            # ── 5. 피드백 섹션 구성 (재시도 시) ──────────────────────────
            feedback_section = ""
            if feedback:
                feedback_section = f"\n\n{feedback}\n\n위 피드백을 반드시 반영하여 주제를 재구성하세요.\n"

            # ── 6. 프롬프트 조립 ──────────────────────────────────────────
            prompt = f"""다음 정보를 바탕으로 구체적인 데이터 분석 주제를 발굴해주세요.

{collab_text}

## 가용 데이터 카탈로그 (필터링됨 — 이 목록에 존재하는 테이블명만 사용)
아래 카탈로그에 없는 테이블명·컬럼명은 절대 사용하지 마세요.
{filtered_catalog_text}

## 기관별 정책 관심사 (RAG 검색 결과)
{self.format_search_results(policy_results)}

## 분석 우수사례 참고
{self.format_search_results(case_results)}
{feedback_section}
위 정보를 종합하여:
- 제공된 카탈로그의 실제 테이블·컬럼을 사용한 구체적 분석 주제를 최소 3개 발굴하세요.
- 각 주제는 두 기관 모두에 실질적인 정책 변화를 가져와야 합니다.
- 테이블명과 컬럼명은 카탈로그에 있는 그대로 사용하세요.
- JSON 형식으로만 응답하세요."""

            # ── 7. LLM 호출 ───────────────────────────────────────────────
            response = self.call_llm(prompt, max_tokens=8192)

            # ── 8. JSON 파싱 ──────────────────────────────────────────────
            try:
                if "```json" in response:
                    json_str = response.split("```json")[1].split("```")[0]
                elif "```" in response:
                    json_str = response.split("```")[1].split("```")[0]
                else:
                    json_str = response
                data = json.loads(json_str.strip())
            except json.JSONDecodeError:
                logger.warning(f"[{self.name}] JSON 파싱 실패 — 원본 응답 저장")
                data = {"raw_response": response, "topics": []}

            n_topics = len(data.get("topics", []))
            logger.info(f"[{self.name}] 주제 발굴 완료: {n_topics}개")
            return AgentResult(
                agent_name=self.name,
                success=True,
                data=data,
                raw_response=response,
            )

        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {e}")
            return AgentResult(
                agent_name=self.name,
                success=False,
                error=str(e),
            )
