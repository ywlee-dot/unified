"""Agent 4: 계획서 생성 에이전트"""

import json
from typing import Any

from loguru import logger

from .base import BaseAgent, AgentResult


class PlanGeneratorAgent(BaseAgent):
    """분석 계획서 초안을 생성하는 에이전트"""

    @property
    def name(self) -> str:
        return "PlanGenerator"

    @property
    def system_prompt(self) -> str:
        return """당신은 공공데이터 분석 계획서 작성 전문가입니다.

주어진 분석 주제와 데이터 매핑 정보를 바탕으로:
1. 체계적인 분석 계획서를 작성합니다
2. 단계별 수행 내용을 구체화합니다
3. 일정 및 산출물을 명시합니다
4. 리스크와 대응 방안을 제시합니다

응답은 반드시 다음 JSON 형식으로 작성하세요:
{
    "plan_id": "PLAN_001",
    "title": "분석 과제명",
    "overview": {
        "background": "추진 배경",
        "objective": "분석 목적",
        "scope": "분석 범위",
        "expected_impact": "기대 효과"
    },
    "collaboration_info": {
        "data_provider": "데이터 제공 기관",
        "data_user": "데이터 활용 기관",
        "roles": "역할 분담"
    },
    "data_plan": {
        "required_datasets": ["필요 데이터셋1", "필요 데이터셋2"],
        "data_processing": "데이터 전처리 계획",
        "integration_approach": "데이터 결합 방안"
    },
    "methodology": {
        "analysis_approach": "분석 접근 방법",
        "techniques": ["분석 기법1", "분석 기법2"],
        "tools": ["활용 도구1", "활용 도구2"]
    },
    "schedule": [
        {
            "phase": "1단계",
            "duration": "2주",
            "tasks": ["수행 내용1", "수행 내용2"],
            "deliverables": ["산출물1", "산출물2"]
        }
    ],
    "risks": [
        {
            "risk": "리스크 내용",
            "probability": "상/중/하",
            "impact": "상/중/하",
            "mitigation": "대응 방안"
        }
    ],
    "success_criteria": ["성공 기준1", "성공 기준2"]
}"""

    def run(self, context: dict[str, Any]) -> AgentResult:
        """계획서 생성 실행"""
        logger.info(f"[{self.name}] 계획서 생성 시작")

        try:
            # 이전 에이전트 결과 활용
            topics_data = context.get("topic_discoverer", {})
            mappings_data = context.get("data_mapper", {})

            topics = topics_data.get("topics", [])
            mappings = mappings_data.get("mappings", [])

            if not topics:
                logger.warning(f"[{self.name}] 분석할 주제가 없습니다")
                return AgentResult(
                    agent_name=self.name,
                    success=False,
                    error="분석할 주제가 없습니다"
                )

            # 주제와 매핑 정보 결합
            topic_mapping_pairs = []
            for topic in topics:
                topic_id = topic.get("id", "")
                matching_mapping = next(
                    (m for m in mappings if m.get("topic_id") == topic_id),
                    {}
                )
                topic_mapping_pairs.append({
                    "topic": topic,
                    "mapping": matching_mapping
                })

            all_plans = []

            for pair in topic_mapping_pairs:
                topic = pair["topic"]
                mapping = pair["mapping"]

                topic_id = topic.get("id", "UNKNOWN")
                topic_title = topic.get("title", "제목 없음")

                # 컨텍스트 구성
                prompt = f"""다음 분석 주제에 대한 분석 계획서를 작성해주세요.

## 분석 주제 정보
- ID: {topic_id}
- 제목: {topic_title}
- 설명: {topic.get('description', 'N/A')}
- 데이터 제공 기관: {topic.get('collaboration', {}).get('data_provider', 'N/A')}
- 데이터 활용 기관: {topic.get('collaboration', {}).get('data_user', 'N/A')}
- 기대 효과: {', '.join(topic.get('expected_outcomes', []))}
- 정책 활용: {topic.get('policy_application', 'N/A')}
- 난이도: {topic.get('difficulty', 'N/A')}
- 예상 기간: {topic.get('estimated_duration', 'N/A')}

## 데이터 매핑 정보
- 필요 데이터셋: {json.dumps(mapping.get('data_requirements', []), ensure_ascii=False, indent=2) if mapping else 'N/A'}
- 데이터 결합 방안: {json.dumps(mapping.get('data_integration', {}), ensure_ascii=False, indent=2) if mapping else 'N/A'}
- 분석 방법론: {json.dumps(mapping.get('analysis_methods', []), ensure_ascii=False, indent=2) if mapping else 'N/A'}
- 실현 가능성: {mapping.get('feasibility_score', 'N/A')} - {mapping.get('feasibility_notes', 'N/A')}

위 정보를 바탕으로 상세한 분석 계획서를 JSON 형식으로 응답해주세요."""

                # LLM 호출
                response = self.call_llm(prompt, max_tokens=6000)

                # JSON 파싱
                try:
                    if "```json" in response:
                        json_str = response.split("```json")[1].split("```")[0]
                    elif "```" in response:
                        json_str = response.split("```")[1].split("```")[0]
                    else:
                        json_str = response

                    plan = json.loads(json_str.strip())
                    all_plans.append(plan)
                except json.JSONDecodeError:
                    logger.warning(f"[{self.name}] JSON 파싱 실패 (주제: {topic_id})")
                    all_plans.append({
                        "plan_id": f"PLAN_{topic_id}",
                        "title": topic_title,
                        "raw_response": response
                    })

            logger.info(f"[{self.name}] 계획서 생성 완료: {len(all_plans)}개")
            return AgentResult(
                agent_name=self.name,
                success=True,
                data={"plans": all_plans}
            )

        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {e}")
            return AgentResult(
                agent_name=self.name,
                success=False,
                error=str(e)
            )
