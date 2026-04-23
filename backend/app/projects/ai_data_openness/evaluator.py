"""
AI 친화성 평가 엔진. LLM Provider를 사용하여 데이터셋을 평가.
"""

import json
import re
from .llm_provider import LLMProvider
from .prompts import SYSTEM_PROMPT, EVALUATE_PROMPT_TEMPLATE, REPORT_PROMPT_TEMPLATE


def format_data_for_prompt(parsed: dict) -> str:
    """파싱된 데이터를 LLM 프롬프트용 텍스트로 변환."""
    lines = []
    mode = parsed.get("mode", "flat")

    if mode == "hierarchical":
        for d in parsed["data"]:
            cols = d.get("컬럼명_요약", "")
            line = (
                f"[{d['번호']}] {d['데이터명']}"
                f" | 시스템: {d.get('시스템명', '')}"
                f" | 개방: {d.get('개방시점', '')}"
                f" | 상태: {d.get('비고', '')}"
                f" | 컬럼({d.get('컬럼수', 0)}개): {cols}"
            )
            lines.append(line)
    else:
        for i, d in enumerate(parsed["data"], 1):
            parts = [f"[{i}] {d.get('데이터명', d.get('이름', '?'))}"]
            for key in ["분야", "설명", "형태", "개방시점", "URL", "갱신주기"]:
                if d.get(key):
                    parts.append(f"{key}: {d[key]}")
            lines.append(" | ".join(parts))

    return "\n".join(lines)


def extract_json_from_response(text: str) -> list:
    """LLM 응답에서 JSON 배열을 추출."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from code block
    match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding array pattern
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return []


def evaluate_datasets(provider: LLMProvider, parsed: dict, institution: str = "") -> dict:
    """데이터셋 목록을 LLM으로 평가."""
    data_text = format_data_for_prompt(parsed)

    if not institution:
        institution = "공공기관"

    user_prompt = EVALUATE_PROMPT_TEMPLATE.format(
        institution=institution,
        data_list=data_text,
    )

    raw_response = provider.evaluate(SYSTEM_PROMPT, user_prompt)
    evaluations = extract_json_from_response(raw_response)

    selected = [e for e in evaluations if e.get("선정여부", False)]
    selected.sort(key=lambda x: x.get("우선순위", 999))
    not_selected = [e for e in evaluations if not e.get("선정여부", False)]

    return {
        "provider": provider.name(),
        "institution": institution,
        "total": len(evaluations),
        "selected_count": len(selected),
        "selected": selected,
        "not_selected": not_selected,
        "raw_response": raw_response,
    }


def generate_report(provider: LLMProvider, evaluation: dict, representative_idx: int = 0) -> str:
    """평가 결과로 첨부2 보고서를 생성."""
    selected = evaluation["selected"]
    if not selected:
        return "선정된 데이터가 없어 보고서를 생성할 수 없습니다."

    rep_data = selected[min(representative_idx, len(selected) - 1)]

    eval_summary = json.dumps(selected, ensure_ascii=False, indent=2)
    rep_summary = json.dumps(rep_data, ensure_ascii=False, indent=2)

    user_prompt = REPORT_PROMPT_TEMPLATE.format(
        institution=evaluation["institution"],
        evaluation_result=eval_summary,
        representative_data=rep_summary,
    )

    return provider.evaluate(SYSTEM_PROMPT, user_prompt)
