"""Orchestrator Agent: 전체 흐름 제어"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from loguru import logger

from ..catalog_parser import CatalogParser
from ..catalog_validator import CatalogValidator
from ..config import settings
from ..vector_store import VectorStore
from .base import AgentResult
from .institution_matcher import InstitutionMatcherAgent
from .topic_discoverer import TopicDiscovererAgent
from .data_mapper import DataMapperAgent
from .plan_generator import PlanGeneratorAgent

MAX_TOPIC_RETRIES = 2  # Agent 2 검증 실패 시 최대 재시도 횟수


class OrchestratorAgent:
    """전체 에이전트 파이프라인을 조율하는 오케스트레이터"""

    def __init__(self, vector_store: VectorStore | None = None):
        self.vector_store = vector_store or VectorStore()
        self.context: dict[str, Any] = {}
        self.results: list[AgentResult] = []
        self.execution_log: list[dict] = []

    def _prepare_filtered_catalog(self) -> None:
        """
        Agent 1 결과에서 기관명 + 도메인 키워드를 추출하여
        필터링된 카탈로그 텍스트를 context에 저장.
        """
        pairs = self.context.get("institution_matcher", {}).get("collaboration_pairs", [])

        institution_names: list[str] = list({
            name
            for pair in pairs
            for name in [pair.get("institution_a", ""), pair.get("institution_b", "")]
            if name
        })
        domain_keywords: list[str] = list({
            kw
            for pair in pairs
            for kw in pair.get("domain_keywords", [])
            if kw
        })

        logger.info(
            f"[Orchestrator] 카탈로그 필터링 — 기관: {institution_names}, "
            f"키워드: {domain_keywords}"
        )

        # BaseAgent의 헬퍼 메서드를 통해 필터링된 텍스트 생성
        from .topic_discoverer import TopicDiscovererAgent
        tmp_agent = TopicDiscovererAgent(self.vector_store)
        filtered_text = tmp_agent.get_filtered_catalog_for_prompt(
            institution_names, domain_keywords
        )
        self.context["filtered_catalog_text"] = filtered_text

    def _build_validator(self) -> Optional[CatalogValidator]:
        """catalog_index.json 로드 후 CatalogValidator 생성. 없으면 None 반환."""
        catalog_index = CatalogParser.load_catalog_index(settings.paths.catalog_index_path)
        if not catalog_index:
            logger.warning(
                "[Orchestrator] catalog_index.json 없음 — 검증 스킵. Phase 1을 먼저 실행하세요."
            )
            return None
        return CatalogValidator(catalog_index)

    def _finalize(self, pipeline_result: dict) -> dict:
        """파이프라인 조기 종료 시 결과 정리."""
        pipeline_result["end_time"] = datetime.now().isoformat()
        pipeline_result["execution_log"] = self.execution_log
        return pipeline_result

    def _log_step(self, agent_name: str, status: str, message: str = ""):
        """실행 단계 로깅"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "agent": agent_name,
            "status": status,
            "message": message
        }
        self.execution_log.append(log_entry)
        logger.info(f"[Orchestrator] {agent_name}: {status} - {message}")

    def run_pipeline(self, skip_on_error: bool = False) -> dict:
        """전체 파이프라인 실행"""
        logger.info("=" * 60)
        logger.info("Phase 2 파이프라인 시작")
        logger.info("=" * 60)

        pipeline_result = {
            "status": "running",
            "start_time": datetime.now().isoformat(),
            "agents": {},
            "final_output": None
        }

        # ── Agent 1: 기관 매칭 ──────────────────────────────────────────
        matcher = InstitutionMatcherAgent(self.vector_store)
        self._log_step(matcher.name, "시작")
        try:
            match_result = matcher.run(self.context)
            self.results.append(match_result)
            if match_result.success:
                self.context["institution_matcher"] = match_result.data
                pipeline_result["agents"]["institution_matcher"] = {
                    "status": "success",
                    "data": match_result.data,
                }
                self._log_step(matcher.name, "완료", "성공")
            else:
                pipeline_result["agents"]["institution_matcher"] = {
                    "status": "failed",
                    "error": match_result.error,
                }
                self._log_step(matcher.name, "실패", match_result.error or "알 수 없는 오류")
                if not skip_on_error:
                    pipeline_result["status"] = "failed"
                    return self._finalize(pipeline_result)
        except Exception as e:
            pipeline_result["agents"]["institution_matcher"] = {"status": "error", "error": str(e)}
            self._log_step(matcher.name, "오류", str(e))
            if not skip_on_error:
                pipeline_result["status"] = "error"
                return self._finalize(pipeline_result)

        # ── Agent 1 → Agent 2 사이: 카탈로그 필터링 ────────────────────
        self._prepare_filtered_catalog()

        # ── Agent 2: 주제 발굴 (검증 실패 시 재시도) ─────────────────────
        discoverer = TopicDiscovererAgent(self.vector_store)
        validator = self._build_validator()
        feedback: Optional[str] = None
        topic_result: Optional[AgentResult] = None

        for attempt in range(MAX_TOPIC_RETRIES + 1):
            attempt_label = f"시도 {attempt + 1}/{MAX_TOPIC_RETRIES + 1}"
            self._log_step(discoverer.name, f"시작 ({attempt_label})")

            try:
                topic_result = discoverer.run(self.context, feedback=feedback)
                self.results.append(topic_result)

                if not topic_result.success:
                    self._log_step(discoverer.name, "실패", topic_result.error or "알 수 없는 오류")
                    if not skip_on_error:
                        pipeline_result["status"] = "failed"
                        break
                    break

                # ── 코드 레벨 검증 ──────────────────────────────────────
                if validator:
                    validation = validator.validate_topics(topic_result.data)
                    self._log_step(
                        discoverer.name,
                        f"검증 {'통과' if validation.all_valid else '실패'}",
                        f"테이블 {len(validation.results)}개 중 {validation.invalid_count}개 미존재"
                        if not validation.all_valid else "모든 테이블 확인됨",
                    )

                    if validation.all_valid or attempt == MAX_TOPIC_RETRIES:
                        if not validation.all_valid:
                            # 최종 재시도 후에도 실패 → 추가 데이터 안내 첨부
                            guidance = validator.build_insufficient_data_guidance(validation)
                            topic_result.data["insufficient_data_guidance"] = guidance
                            logger.warning(
                                f"[Orchestrator] 최대 재시도 초과 — 추가 데이터 안내 첨부"
                            )
                        break
                    else:
                        feedback = validator.build_feedback(validation)
                        logger.info(f"[Orchestrator] 재시도 준비 — 피드백 생성됨")
                        continue
                else:
                    # validator 없으면 그냥 통과
                    break

            except Exception as e:
                error_msg = str(e)
                self._log_step(discoverer.name, "오류", error_msg)
                if not skip_on_error:
                    pipeline_result["status"] = "error"
                    break

        if topic_result and topic_result.success:
            self.context["topic_discoverer"] = topic_result.data
            pipeline_result["agents"]["topic_discoverer"] = {
                "status": "success",
                "data": topic_result.data,
            }
            self._log_step(discoverer.name, "완료", "성공")

        # 최종 결과 정리
        if pipeline_result["status"] == "running":
            pipeline_result["status"] = "completed"

        pipeline_result["end_time"] = datetime.now().isoformat()
        pipeline_result["execution_log"] = self.execution_log

        # 최종 산출물 구성
        if pipeline_result["status"] == "completed":
            pipeline_result["final_output"] = self._generate_final_output()

        logger.info("=" * 60)
        logger.info(f"Phase 2 파이프라인 완료: {pipeline_result['status']}")
        logger.info("=" * 60)

        return pipeline_result

    def _generate_final_output(self) -> dict:
        """최종 산출물 생성"""
        institutions = self.context.get("institution_matcher", {})
        topics = self.context.get("topic_discoverer", {})
        mappings = self.context.get("data_mapper", {})
        plans = self.context.get("plan_generator", {})

        return {
            "summary": {
                "total_institutions": len(institutions.get("institutions", [])),
                "collaboration_pairs": len(institutions.get("collaboration_pairs", [])),
                "discovered_topics": len(topics.get("topics", [])),
                "generated_plans": len(plans.get("plans", []))
            },
            "institutions": institutions,
            "topics": topics,
            "data_mappings": mappings,
            "analysis_plans": plans
        }

    def save_results(self, output_path: Path | None = None) -> Path:
        """결과 저장"""
        if output_path is None:
            output_path = settings.paths.reports_dir / f"phase2_result_{datetime.now():%Y%m%d_%H%M%S}.json"

        output_path.parent.mkdir(parents=True, exist_ok=True)

        # 전체 컨텍스트 저장
        output_data = {
            "timestamp": datetime.now().isoformat(),
            "execution_log": self.execution_log,
            "context": self.context
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        logger.info(f"결과 저장 완료: {output_path}")
        return output_path

    def generate_report(self) -> str:
        """사람이 읽기 좋은 리포트 생성"""
        lines = []
        lines.append("=" * 60)
        lines.append("[REPORT] 분석 주제 탐색 결과 리포트")
        lines.append("=" * 60)
        lines.append("")

        # 1. 기관 분석 결과
        institutions = self.context.get("institution_matcher", {})
        lines.append("## 1. 협력 가능 기관 분석")
        lines.append("-" * 40)

        for inst in institutions.get("institutions", []):
            lines.append(f"\n### {inst.get('name', 'N/A')}")
            lines.append(f"- 핵심 도메인: {inst.get('core_domain', 'N/A')}")
            lines.append(f"- 주요 데이터: {', '.join(inst.get('key_data_assets', []))}")
            lines.append(f"- 정책 관심사: {', '.join(inst.get('policy_interests', []))}")

        lines.append("\n### 협력 조합")
        for pair in institutions.get("collaboration_pairs", []):
            lines.append(f"\n[협력] {pair.get('institution_a', 'N/A')} <-> {pair.get('institution_b', 'N/A')}")
            lines.append(f"   시너지 점수: {pair.get('synergy_score', 'N/A')}")
            lines.append(f"   사유: {pair.get('synergy_reason', 'N/A')}")

        # 2. 분석 주제
        topics = self.context.get("topic_discoverer", {})
        lines.append("\n\n## 2. 발굴된 분석 주제")
        lines.append("-" * 40)

        for topic in topics.get("topics", []):
            lines.append(f"\n### [{topic.get('id', 'N/A')}] {topic.get('title', 'N/A')}")
            lines.append(f"- 설명: {topic.get('description', 'N/A')}")
            collab = topic.get("collaboration", {})
            lines.append(f"- 데이터 제공: {collab.get('data_provider', 'N/A')}")
            lines.append(f"- 데이터 활용: {collab.get('data_user', 'N/A')}")
            lines.append(f"- 난이도: {topic.get('difficulty', 'N/A')}")
            lines.append(f"- 예상 기간: {topic.get('estimated_duration', 'N/A')}")
            lines.append(f"- 우선순위: {topic.get('priority_score', 'N/A')}")

        # 3. 분석 계획
        plans = self.context.get("plan_generator", {})
        lines.append("\n\n## 3. 분석 계획서 요약")
        lines.append("-" * 40)

        for plan in plans.get("plans", []):
            lines.append(f"\n### {plan.get('title', 'N/A')}")
            overview = plan.get("overview", {})
            lines.append(f"- 목적: {overview.get('objective', 'N/A')}")
            lines.append(f"- 범위: {overview.get('scope', 'N/A')}")

            schedule = plan.get("schedule", [])
            if schedule:
                lines.append("- 일정:")
                for phase in schedule:
                    lines.append(f"  • {phase.get('phase', 'N/A')} ({phase.get('duration', 'N/A')})")

        lines.append("\n" + "=" * 60)
        lines.append("리포트 생성 완료")
        lines.append("=" * 60)

        return "\n".join(lines)
