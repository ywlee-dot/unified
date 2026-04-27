"""Business logic service for AI Data Openness project."""

from __future__ import annotations

from typing import Any, Dict

from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.services.execution_recorder import (
    ExecutionRecorder,
    serialize_execution,
)

from .parser import parse_excel
from .evaluator import evaluate_datasets, generate_report
from .phase2_parser import parse_phase2_excel
from .phase2_evaluator import generate_phase2_report
from .llm_provider import get_provider, PROVIDERS

PROJECT_SLUG = "ai_data_openness"

# 세션 저장 (메모리)
SESSIONS: Dict[str, Dict[str, Any]] = {}


class AIDataOpennessService:
    """AI 친화·고가치 데이터 개방 보고서 생성 서비스."""

    # ── Providers ─────────────────────────────────────────────────────────

    def list_providers(self) -> list[str]:
        return list(PROVIDERS.keys())

    # ── Phase 1 ───────────────────────────────────────────────────────────

    async def upload(self, file_content: bytes, filename: str) -> dict:
        parsed = parse_excel(file_content, filename)
        session_id = str(hash(filename + str(len(file_content))))
        SESSIONS[session_id] = {"parsed": parsed, "evaluation": None, "report": None}
        return {"session_id": session_id, "parsed": parsed}

    async def evaluate(
        self,
        session_id: str,
        institution: str = "공공기관",
        provider_name: str = "claude",
        api_key: str = "",
    ) -> dict:
        if session_id not in SESSIONS:
            raise ValueError("세션을 찾을 수 없습니다. Excel을 다시 업로드해주세요.")

        parsed = SESSIONS[session_id]["parsed"]
        kwargs = {}
        if api_key:
            kwargs["api_key"] = api_key
        provider = get_provider(provider_name, **kwargs)

        result = evaluate_datasets(provider, parsed, institution)
        SESSIONS[session_id]["evaluation"] = result
        return result

    async def report(
        self,
        session_id: str,
        representative_idx: int = 0,
        provider_name: str = "claude",
        api_key: str = "",
        institution: str = "공공기관",
        db: AsyncSession | None = None,
    ) -> dict:
        if session_id not in SESSIONS:
            raise ValueError("세션을 찾을 수 없습니다.")

        evaluation = SESSIONS[session_id].get("evaluation")
        if not evaluation:
            raise ValueError("먼저 평가를 실행해주세요.")

        kwargs = {}
        if api_key:
            kwargs["api_key"] = api_key
        provider = get_provider(provider_name, **kwargs)

        execution = None
        if db is not None:
            execution = await ExecutionRecorder.create(
                db,
                project_slug=PROJECT_SLUG,
                process_type="inprocess",
                input_metadata={
                    "phase": 1,
                    "session_id": session_id,
                    "institution": institution,
                    "provider": provider_name,
                    "representative_idx": representative_idx,
                },
                input_summary=f"[Phase1] {institution} · 대표후보#{representative_idx}",
            )

        try:
            report_text = generate_report(provider, evaluation, representative_idx)
            SESSIONS[session_id]["report"] = report_text

            response = {"report": report_text}

            if db is not None and execution is not None:
                await ExecutionRecorder.mark_succeeded(
                    db,
                    execution_id=execution.execution_id,
                    result_data={
                        "phase": 1,
                        "report": report_text,
                        "institution": institution,
                        "representative_idx": representative_idx,
                        "evaluation": evaluation,
                    },
                )
                response["execution_id"] = execution.execution_id

            return response
        except Exception as exc:
            if db is not None and execution is not None:
                try:
                    await ExecutionRecorder.mark_failed(
                        db,
                        execution_id=execution.execution_id,
                        error_message=str(exc),
                    )
                except Exception:  # noqa: BLE001
                    pass
            raise

    # ── Phase 1 Demo ──────────────────────────────────────────────────────

    def demo_parsed(self) -> dict:
        from .seed_data import SEED_PARSED
        session_id = "demo-session"
        SESSIONS[session_id] = {"parsed": SEED_PARSED, "evaluation": None, "report": None}
        return {"session_id": session_id, "parsed": SEED_PARSED}

    def demo_evaluation(self) -> dict:
        from .seed_data import SEED_PARSED, SEED_EVALUATION
        session_id = "demo-session"
        SESSIONS[session_id] = {"parsed": SEED_PARSED, "evaluation": SEED_EVALUATION, "report": None}
        return SEED_EVALUATION

    def demo_report(self) -> str:
        from .seed_data import SEED_PARSED, SEED_EVALUATION, SEED_REPORT
        session_id = "demo-session"
        SESSIONS[session_id] = {"parsed": SEED_PARSED, "evaluation": SEED_EVALUATION, "report": SEED_REPORT}
        return SEED_REPORT

    # ── Phase 2 ───────────────────────────────────────────────────────────

    async def phase2_upload(self, file_content: bytes, filename: str) -> dict:
        parsed = parse_phase2_excel(file_content, filename)
        session_id = "p2-" + str(hash(filename + str(len(file_content))))
        SESSIONS[session_id] = {"parsed": parsed, "result": None}
        return {"session_id": session_id, "parsed": parsed}

    async def phase2_generate(
        self,
        session_id: str,
        institution: str = "공공기관",
        representative_idx: int = 0,
        provider_name: str = "claude",
        api_key: str = "",
        db: AsyncSession | None = None,
    ) -> dict:
        if session_id not in SESSIONS:
            raise ValueError("세션을 찾을 수 없습니다. Excel을 다시 업로드해주세요.")

        parsed = SESSIONS[session_id]["parsed"]
        kwargs = {}
        if api_key:
            kwargs["api_key"] = api_key
        provider = get_provider(provider_name, **kwargs)

        execution = None
        if db is not None:
            execution = await ExecutionRecorder.create(
                db,
                project_slug=PROJECT_SLUG,
                process_type="inprocess",
                input_metadata={
                    "phase": 2,
                    "session_id": session_id,
                    "institution": institution,
                    "provider": provider_name,
                    "representative_idx": representative_idx,
                    "filename": parsed.get("filename"),
                    "total_count": parsed.get("total_count"),
                },
                input_summary=f"[Phase2] {institution} · {parsed.get('filename', '')}",
            )

        try:
            result = generate_phase2_report(provider, parsed, institution, representative_idx)
            SESSIONS[session_id]["result"] = result

            if db is not None and execution is not None:
                await ExecutionRecorder.mark_succeeded(
                    db,
                    execution_id=execution.execution_id,
                    result_data={
                        "phase": 2,
                        "result": result,
                        "parsed": parsed,
                    },
                )
                result = {**result, "execution_id": execution.execution_id}

            return result
        except Exception as exc:
            if db is not None and execution is not None:
                try:
                    await ExecutionRecorder.mark_failed(
                        db,
                        execution_id=execution.execution_id,
                        error_message=str(exc),
                    )
                except Exception:  # noqa: BLE001
                    pass
            raise

    # ── Execution history ─────────────────────────────────────────────────

    async def list_executions(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        result = await ExecutionRecorder.list(
            db,
            project_slug=PROJECT_SLUG,
            page=page,
            page_size=page_size,
        )
        return {
            "items": [serialize_execution(r) for r in result["items"]],
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"],
            "total_pages": result["total_pages"],
        }

    async def get_execution(
        self,
        db: AsyncSession,
        execution_id: str,
    ) -> dict | None:
        record = await ExecutionRecorder.get(db, execution_id)
        if record is None or record.project_slug != PROJECT_SLUG:
            return None
        return serialize_execution(record, include_result=True)

    async def delete_execution(
        self,
        db: AsyncSession,
        execution_id: str,
    ) -> bool:
        record = await ExecutionRecorder.get(db, execution_id)
        if record is None or record.project_slug != PROJECT_SLUG:
            return False
        return await ExecutionRecorder.delete(db, execution_id)

    # ── Phase 2 Demo ──────────────────────────────────────────────────────

    def phase2_demo_parsed(self) -> dict:
        demo_parsed = {
            "filename": "한국학중앙연구원_AI친화고가치데이터발굴목록.xlsx",
            "sheet": "AI 친화·고가치 데이터 발굴 목록",
            "total_count": 3,
            "data": [
                {
                    "번호": "1",
                    "발굴루트": "홈페이지 보도자료",
                    "담당부서": "한국학정보화실",
                    "후보군명": "한국학 전문사전 관련 학술 콘텐츠",
                    "구성안": "한국민족문화대백과사전, 한국향토문화전자대전 등 전문사전 텍스트·이미지 데이터. 항목명, 분류, 본문, 참고문헌, 집필자, 이미지 등 포함.",
                    "예상활용사례": "한국학 AI 언어모델 학습, 문화유산 검색 서비스, 교육 콘텐츠 자동 생성",
                    "비고": "",
                    "개방가능여부": "가능",
                },
                {
                    "번호": "2",
                    "발굴루트": "한국학자료통합플랫폼",
                    "담당부서": "한국학정보화실",
                    "후보군명": "한국 지역별 방언 말뭉치",
                    "구성안": "전국 17개 시도 방언 음성·텍스트 말뭉치. 발화자 정보(연령·성별·지역), 전사 텍스트, 음성 파일 포함.",
                    "예상활용사례": "방언 음성인식 AI 개발, 지역 문화 콘텐츠 서비스, 언어학 연구",
                    "비고": "",
                    "개방가능여부": "가능",
                },
                {
                    "번호": "3",
                    "발굴루트": "한국학 영문 용어·용례 사전",
                    "담당부서": "해외한국학지원실",
                    "후보군명": "한국학 영문 용어·용례 사전",
                    "구성안": "한국 문화·역사·사회 관련 영문 표준 용어 및 용례 데이터. 한국어 원어, 영문 표기, 용례 문장, 분야 분류 포함.",
                    "예상활용사례": "한영 번역 AI 학습, 한국학 영문 콘텐츠 자동화, 해외 한국학 교육 플랫폼",
                    "비고": "",
                    "개방가능여부": "가능",
                },
            ],
        }
        session_id = "p2-demo-session"
        SESSIONS[session_id] = {"parsed": demo_parsed, "result": None}
        return {"session_id": session_id, "parsed": demo_parsed}

    def phase2_demo_report(self) -> dict:
        import re

        demo_report = """# (한국학중앙연구원) AI 친화·고가치 데이터 개방 노력 (지표①-②)

## ❶ AI 친화·고가치 데이터 개방 실적 ('25.10.31. 기준)

| 우선순위 | 분야 | 목록명 | 형태 | 개방시점 | 개방URL |
|---------|------|--------|------|---------|--------|
| ① | 교육 | 한국학 전문사전 관련 학술 콘텐츠 | □ 정형 ■ 비정형 | 2025.06 | https://encykorea.aks.ac.kr |
| ② | 교육 | 한국학 영문 용어·용례 사전 | ■ 정형 □ 비정형 | 2025.08 | https://encykorea.aks.ac.kr/english |

## ❷ AI 친화·고가치 데이터 개방 계획 ('25.11월 이후)

| 우선순위 | 분야 | 목록명 | 형태 | 개방시점(예정) |
|---------|------|--------|------|--------------|
| ① | 교육 | 한국 지역별 방언 말뭉치 | □ 정형 ■ 비정형 | 2026.03 예정 |

## ❸ AI 친화·고가치 데이터 설명 (1건 상세)

| 목록명 | 한국학 전문사전 관련 학술 콘텐츠 | 형태 | □ 정형 ■ 비정형 |
|--------|-------------------------------|------|----------------|
| 개방URL | https://encykorea.aks.ac.kr | 개방시점 | 2025.06 |

**▶ 주요내용**
- 데이터 컬럼명: 항목명, 분류코드, 본문텍스트, 참고문헌, 집필자, 이미지URL, 최종수정일
- 데이터 축적 기간: 1980년 초판 발간 이후 45년간 축적, 지속 갱신
- 지역적 분포: 전국 단위 한국 문화·역사·지리 항목 포함 (제주 포함 전국 17개 시도)
- 수집 목적: 한국 문화유산 및 학술 지식의 체계적 디지털화 및 보급
- 활용 대상: AI 연구자, 교육 콘텐츠 개발자, 한국학 연구자, 문화유산 서비스 기업

**▶ 고수요·고가치성**
2024년 공공데이터 수요조사에서 한국학 텍스트 데이터에 대한 민간 수요가 교육·AI 분야에서 상위 10위권으로 집계되었습니다.

**▶ AI 친화성**

| 특징 | 여부(O/X) | 설명 |
|------|----------|------|
| 시계열 | O | 1980년 이후 45년간 지속 갱신 데이터 |
| 완결성 | O | 전국 17개 시도 80,000여 항목 수록 |
| 신뢰성 | O | 전문 학자 5,000여 명 집필, 편집위원회 심의 |
| 범용성 | O | JSON·XML·CSV 등 개방형 API 제공 |

**▶ 활용성**
- **한국어 LLM 고도화**: 80,000여 항목의 전문 텍스트를 사전학습 데이터로 활용
- **지능형 문화유산 검색 서비스**: 지식그래프 기반 의미 검색 및 추천
- **맞춤형 교육 콘텐츠 자동 생성**: 학습 수준별·지역별 문화 교육 콘텐츠 AI 생성"""

        parts = re.split(r'(?=## ❶|## ❷|## ❸)', demo_report)
        sections = {}
        for part in parts:
            if '❶' in part:
                sections['section1'] = part.strip()
            elif '❷' in part:
                sections['section2'] = part.strip()
            elif '❸' in part:
                sections['section3'] = part.strip()

        return {
            "institution": "한국학중앙연구원",
            "provider": "demo",
            "total": 3,
            "representative": {"후보군명": "한국학 전문사전 관련 학술 콘텐츠"},
            "research_context": "",
            "draft": demo_report,
            "review_feedback": "",
            "final_report": demo_report,
            "sections": sections,
        }
