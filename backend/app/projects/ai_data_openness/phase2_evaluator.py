"""
3-에이전트 파이프라인 평가 엔진.
Researcher → Writer → Reviewer/Reviser 순서로 첨부2 보고서를 생성.
"""

import json
import re

from .llm_provider import LLMProvider
from .phase2_prompts import (
    RESEARCHER_SYSTEM_PROMPT,
    RESEARCHER_PROMPT_TEMPLATE,
    WRITER_SYSTEM_PROMPT,
    WRITER_PROMPT_TEMPLATE,
    REVIEWER_SYSTEM_PROMPT,
    REVIEWER_PROMPT_TEMPLATE,
    REVISION_PROMPT_TEMPLATE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_data_for_researcher(parsed: dict) -> str:
    """파싱된 Phase 2 데이터를 연구원 프롬프트용 텍스트로 변환."""
    lines = []
    for item in parsed.get("data", []):
        parts = [
            f"[{item.get('번호', '?')}] {item.get('후보군명', item.get('데이터명', '?'))}",
        ]
        for key in ["발굴루트", "담당부서", "구성안", "예상활용사례", "개방가능여부", "비고"]:
            val = item.get(key, "")
            if val:
                parts.append(f"{key}: {val}")
        lines.append(" | ".join(parts))
    return "\n".join(lines)


def _format_data_for_writer(parsed: dict) -> str:
    """파싱된 데이터를 작성자 프롬프트용 텍스트로 변환."""
    return _format_data_for_researcher(parsed)


def _extract_json_from_response(text: str) -> dict | list | None:
    """LLM 응답에서 JSON 객체 또는 배열을 추출."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass

    match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", text)
    if match:
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, ValueError):
            pass

    # Try object
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except (json.JSONDecodeError, ValueError):
            pass

    return None


def _split_report_sections(report_text: str) -> dict:
    """보고서 텍스트를 ❶❷❸ 마커 기준으로 3개 섹션으로 분리."""
    # Patterns to match section markers
    pattern = re.compile(r"(❶|❷|❸|[①②③]|\[1\]|\[2\]|\[3\])")

    # Find all section start positions using ❶❷❸
    sec1_match = re.search(r"❶[^\n]*\n", report_text)
    sec2_match = re.search(r"❷[^\n]*\n", report_text)
    sec3_match = re.search(r"❸[^\n]*\n", report_text)

    if not (sec1_match and sec2_match and sec3_match):
        # Fallback: try to split by section header lines
        return {
            "section1": "",
            "section2": "",
            "section3": report_text,
        }

    s1_start = sec1_match.start()
    s2_start = sec2_match.start()
    s3_start = sec3_match.start()

    section1 = report_text[s1_start:s2_start].strip()
    section2 = report_text[s2_start:s3_start].strip()
    section3 = report_text[s3_start:].strip()

    return {
        "section1": section1,
        "section2": section2,
        "section3": section3,
    }


def _get_representative_item(parsed: dict, representative_idx: int) -> dict:
    """대표사례 데이터 항목을 반환."""
    data = parsed.get("data", [])
    if not data:
        return {}
    idx = min(representative_idx, len(data) - 1)
    return data[idx]


# ---------------------------------------------------------------------------
# Pipeline stages
# ---------------------------------------------------------------------------

def research_context(provider: LLMProvider, parsed: dict, institution: str) -> str:
    """
    Stage 1: Researcher 에이전트.
    데이터 목록을 분석하여 보고서 작성에 필요한 심층 조사 컨텍스트를 반환.
    """
    data_summary = _format_data_for_researcher(parsed)
    user_prompt = RESEARCHER_PROMPT_TEMPLATE.format(
        institution=institution,
        data_summary=data_summary,
    )
    return provider.evaluate(RESEARCHER_SYSTEM_PROMPT, user_prompt)


def write_draft(
    provider: LLMProvider,
    parsed: dict,
    institution: str,
    researcher_context: str,
    representative_idx: int = 0,
) -> str:
    """
    Stage 2: Writer 에이전트.
    연구원 컨텍스트를 바탕으로 첨부2 보고서 초안을 작성.
    """
    data_list = _format_data_for_writer(parsed)
    rep_item = _get_representative_item(parsed, representative_idx)
    representative_data = json.dumps(rep_item, ensure_ascii=False, indent=2)

    user_prompt = WRITER_PROMPT_TEMPLATE.format(
        institution=institution,
        data_list=data_list,
        research_context=researcher_context,
        representative_data=representative_data,
    )
    return provider.evaluate(WRITER_SYSTEM_PROMPT, user_prompt)


def review_and_refine(
    provider: LLMProvider,
    draft: str,
    parsed: dict,
    institution: str,
) -> tuple[str, str]:
    """
    Stage 3: Reviewer + Reviser 에이전트.
    초안을 검토하고 피드백을 반영하여 최종 보고서를 생성.

    Returns:
        (review_feedback_str, final_report_str)
    """
    original_data = json.dumps(parsed.get("data", []), ensure_ascii=False, indent=2)

    # 3a. Reviewer
    reviewer_prompt = REVIEWER_PROMPT_TEMPLATE.format(
        institution=institution,
        draft_report=draft,
        original_data=original_data,
    )
    review_feedback = provider.evaluate(REVIEWER_SYSTEM_PROMPT, reviewer_prompt)

    # Parse reviewer JSON to check if revision is needed
    feedback_data = _extract_json_from_response(review_feedback)
    revision_needed = True
    if isinstance(feedback_data, dict):
        revision_needed = feedback_data.get("revision_needed", True)

    # 3b. Reviser (only if revision needed)
    if revision_needed:
        revision_prompt = REVISION_PROMPT_TEMPLATE.format(
            original_draft=draft,
            reviewer_feedback=review_feedback,
        )
        # Revision uses WRITER system prompt for consistent formatting style
        final_report = provider.evaluate(WRITER_SYSTEM_PROMPT, revision_prompt)
    else:
        final_report = draft

    return review_feedback, final_report


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------

def generate_phase2_report(
    provider: LLMProvider,
    parsed: dict,
    institution: str = "",
    representative_idx: int = 0,
) -> dict:
    """
    3-에이전트 파이프라인으로 첨부2 보고서를 생성.

    Args:
        provider: LLM 제공자 인스턴스
        parsed: phase2_parser.parse_phase2_excel() 반환값
        institution: 기관명 (없으면 "공공기관")
        representative_idx: 대표사례로 사용할 데이터 인덱스

    Returns:
        {
            "institution": str,
            "provider": str,
            "total": int,
            "representative": dict,
            "research_context": str,
            "draft": str,
            "review_feedback": str,
            "final_report": str,
            "sections": {
                "section1": str,  # ❶ 개방 실적
                "section2": str,  # ❷ 개방 계획
                "section3": str,  # ❸ 데이터 설명
            }
        }
    """
    if not institution:
        institution = "공공기관"

    data = parsed.get("data", [])
    rep_item = _get_representative_item(parsed, representative_idx)

    # Stage 1: Research
    ctx = research_context(provider, parsed, institution)

    # Stage 2: Write draft
    draft = write_draft(provider, parsed, institution, ctx, representative_idx)

    # Stage 3: Review and refine
    review_feedback, final_report = review_and_refine(
        provider, draft, parsed, institution
    )

    # Split final report into sections
    sections = _split_report_sections(final_report)

    return {
        "institution": institution,
        "provider": provider.name(),
        "total": len(data),
        "representative": rep_item,
        "research_context": ctx,
        "draft": draft,
        "review_feedback": review_feedback,
        "final_report": final_report,
        "sections": sections,
    }
