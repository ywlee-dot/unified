"""Business logic service for Survey Platform project."""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

# 프로젝트 내 data/ 디렉토리를 기준으로 경로 설정
_PROJECT_DIR = Path(__file__).parent
_DATA_DIR = _PROJECT_DIR / "data"

TEMPLATE_DIR = str(_DATA_DIR / "templates")
UPLOAD_DIR = str(_DATA_DIR / "uploads")
SURVEY_DIR = str(_DATA_DIR / "surveys")
RESPONSE_DIR = str(_DATA_DIR / "responses")
EXPORT_DIR = str(_DATA_DIR / "exports")
REPORT_DIR = str(_DATA_DIR / "reports")

for d in [TEMPLATE_DIR, UPLOAD_DIR, SURVEY_DIR, RESPONSE_DIR, EXPORT_DIR, REPORT_DIR]:
    os.makedirs(d, exist_ok=True)


def _calc_status(survey_data: dict, today: str) -> str:
    start = survey_data["survey_metadata"].get("start_date", "")
    end = survey_data["survey_metadata"].get("end_date", "")
    if today > end:
        return "종료"
    elif today < start:
        return "대기"
    return "진행"


def _find_latest_report(survey_id: str) -> str | None:
    prefix = f"report_{survey_id}_"
    if not os.path.exists(REPORT_DIR):
        return None
    candidates = [
        f for f in os.listdir(REPORT_DIR)
        if f.startswith(prefix) and f.endswith(".xlsx")
    ]
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return os.path.join(REPORT_DIR, candidates[0])


class SurveyPlatformService:
    """설문조사 생성·분석 서비스."""

    # ── 설문 목록 ─────────────────────────────────────────────────────

    def list_surveys(self) -> list[dict[str, Any]]:
        surveys = []
        today = datetime.now().strftime("%Y-%m-%d")
        if not os.path.exists(SURVEY_DIR):
            return surveys
        for fname in os.listdir(SURVEY_DIR):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(SURVEY_DIR, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                meta = data["survey_metadata"]
                sid = meta["survey_id"]
                status = _calc_status(data, today)

                from .generator.response_collector import ResponseCollector
                collector = ResponseCollector(RESPONSE_DIR)
                responses = collector.load_all_responses(sid)

                surveys.append({
                    "survey_id": sid,
                    "survey_type": meta.get("survey_type", ""),
                    "institution_name": meta.get("institution_name", ""),
                    "start_date": meta.get("start_date", ""),
                    "end_date": meta.get("end_date", ""),
                    "status": status,
                    "has_report": _find_latest_report(sid) is not None,
                    "response_count": len(responses),
                    "created_at": meta.get("created_at", ""),
                })
            except Exception as e:
                print(f"[WARN] 설문 로드 실패 ({fname}): {e}")
        surveys.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return surveys

    # ── 설문 상세 ─────────────────────────────────────────────────────

    def get_survey(self, survey_id: str) -> dict[str, Any] | None:
        survey_path = os.path.join(SURVEY_DIR, f"{survey_id}.json")
        if not os.path.exists(survey_path):
            return None
        with open(survey_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        today = datetime.now().strftime("%Y-%m-%d")
        status = _calc_status(data, today)

        from .generator.response_collector import ResponseCollector
        collector = ResponseCollector(RESPONSE_DIR)
        responses = collector.load_all_responses(survey_id)

        return {
            **data,
            "status": status,
            "response_count": len(responses),
            "has_report": _find_latest_report(survey_id) is not None,
        }

    # ── 설문 생성 ─────────────────────────────────────────────────────

    async def create_survey(
        self,
        survey_type: str,
        institution_name: str,
        start_date: str,
        end_date: str,
        data_file_content: bytes | None = None,
        data_file_name: str = "",
    ) -> dict:
        from .generator.template_parser import TemplateParser
        from .generator.survey_builder import SurveyBuilder
        from .generator.utils import generate_unique_id

        template_name = (
            "개방데이터_수요조사_템플릿.xlsx"
            if survey_type == "개방데이터"
            else "공유데이터_수요조사_템플릿.xlsx"
        )
        template_path = os.path.join(TEMPLATE_DIR, template_name)

        parser = TemplateParser(template_path)
        template = parser.parse()
        builder = SurveyBuilder(template)
        builder.set_metadata(survey_type + " 수요조사", institution_name, start_date, end_date)

        if data_file_content:
            file_path = os.path.join(UPLOAD_DIR, f"{generate_unique_id()}_{data_file_name}")
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(data_file_content)
            builder.load_data_list_from_excel(file_path)

        survey_id = builder.survey_metadata["survey_id"]
        output_path = os.path.join(SURVEY_DIR, f"{survey_id}.json")
        builder.save_to_file(output_path)

        return {"success": True, "survey_id": survey_id}

    # ── 응답 제출 ─────────────────────────────────────────────────────

    def submit_response(self, survey_id: str, answers: list[dict]) -> dict:
        from .generator.response_collector import ResponseCollector
        collector = ResponseCollector(RESPONSE_DIR)
        resp_id = collector.save_response(survey_id, answers)
        return {"success": True, "response_id": resp_id}

    # ── 내보내기: 답변자별 ────────────────────────────────────────────

    def export_responses(self, survey_id: str) -> str | None:
        from .generator.response_collector import ResponseCollector

        survey_path = os.path.join(SURVEY_DIR, f"{survey_id}.json")
        ordered_questions = None
        if os.path.exists(survey_path):
            with open(survey_path, "r", encoding="utf-8") as f:
                survey_data = json.load(f)
            all_qs = []
            for section in survey_data.get("sections", []):
                all_qs.extend(section.get("questions", []))
            ordered_questions = all_qs or survey_data.get("questions")

        output_path = os.path.join(EXPORT_DIR, f"답변자별_결과_{survey_id}.xlsx")
        collector = ResponseCollector(RESPONSE_DIR)
        path = collector.export_to_excel(survey_id, output_path, ordered_questions=ordered_questions)
        return path if path else None

    # ── 내보내기: 질문별 분포 ─────────────────────────────────────────

    def export_analysis(self, survey_id: str) -> str | None:
        from .generator.response_collector import ResponseCollector

        survey_path = os.path.join(SURVEY_DIR, f"{survey_id}.json")
        if not os.path.exists(survey_path):
            return None
        with open(survey_path, "r", encoding="utf-8") as f:
            survey_data = json.load(f)

        output_path = os.path.join(EXPORT_DIR, f"질문별_결과_{survey_id}.xlsx")
        collector = ResponseCollector(RESPONSE_DIR)
        path = collector.export_analysis_report(survey_id, output_path, survey_data)
        return path if path else None

    # ── AI 분석 실행 ──────────────────────────────────────────────────

    def run_ai_analysis(self, survey_id: str, force: bool = False) -> dict:
        survey_path = os.path.join(SURVEY_DIR, f"{survey_id}.json")
        if not os.path.exists(survey_path):
            return {"success": False, "error": "설문을 찾을 수 없습니다."}

        with open(survey_path, "r", encoding="utf-8") as f:
            survey_data = json.load(f)

        today = datetime.now().strftime("%Y-%m-%d")
        status = _calc_status(survey_data, today)

        if status != "종료" and not force:
            return {
                "success": False,
                "error": f"설문이 아직 진행 중입니다 (상태: {status}). 종료 후 분석하거나 force=true를 사용하세요.",
            }

        def _bg():
            self._execute_analysis(survey_id, survey_data)

        t = threading.Thread(target=_bg, daemon=True)
        t.start()

        return {
            "success": True,
            "message": "분석이 시작되었습니다. 잠시 후 분석 상태를 확인하세요.",
        }

    def _execute_analysis(self, survey_id: str, survey_data: dict):
        try:
            from .analyzer.survey_analyzer import SurveyAdvancedAnalyzer
            from .generator.response_collector import ResponseCollector

            collector = ResponseCollector(RESPONSE_DIR)
            responses = collector.load_all_responses(survey_id)
            if not responses:
                print(f"[ANALYSIS] 응답 없음 ({survey_id})")
                return None

            interim_path = os.path.join(EXPORT_DIR, f"interim_{survey_id}.xlsx")
            path = collector.export_analysis_report(survey_id, interim_path, survey_data)
            if not path:
                print(f"[ANALYSIS] 중간 엑셀 생성 실패 ({survey_id})")
                return None

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_name = f"report_{survey_id}_{timestamp}.xlsx"
            report_path = os.path.join(REPORT_DIR, report_name)

            api_key = os.getenv("GEMINI_API_KEY")
            analyzer = SurveyAdvancedAnalyzer(interim_path, api_key=api_key)
            analyzer.findings_path = report_path
            analyzer.report_dir = REPORT_DIR
            analyzer.chart_img_dir = os.path.join(REPORT_DIR, "chart_images")
            os.makedirs(analyzer.chart_img_dir, exist_ok=True)

            analyzer.run()
            print(f"[ANALYSIS] 분석 완료 -> {report_path}")
            return report_path
        except Exception as e:
            import traceback
            print(f"[ANALYSIS ERROR] {e}")
            traceback.print_exc()
            return None

    # ── 분석 상태 ─────────────────────────────────────────────────────

    def get_analysis_status(self, survey_id: str) -> dict:
        report_path = _find_latest_report(survey_id)
        if report_path:
            mtime = os.path.getmtime(report_path)
            return {
                "ready": True,
                "generated_at": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S"),
            }
        return {"ready": False}

    # ── 분석 리포트 경로 ──────────────────────────────────────────────

    def get_report_path(self, survey_id: str) -> str | None:
        return _find_latest_report(survey_id)

    # ── 설문 수정 ─────────────────────────────────────────────────────

    def update_survey(self, survey_id: str, institution_name: str, start_date: str, end_date: str) -> dict:
        survey_path = os.path.join(SURVEY_DIR, f"{survey_id}.json")
        if not os.path.exists(survey_path):
            return {"success": False, "error": "설문을 찾을 수 없습니다."}

        with open(survey_path, "r", encoding="utf-8") as f:
            survey_data = json.load(f)

        survey_data["survey_metadata"]["institution_name"] = institution_name
        survey_data["survey_metadata"]["start_date"] = start_date
        survey_data["survey_metadata"]["end_date"] = end_date

        with open(survey_path, "w", encoding="utf-8") as f:
            json.dump(survey_data, f, ensure_ascii=False, indent=2)

        return {"success": True}

    # ── 설문 삭제 ─────────────────────────────────────────────────────

    def delete_survey(self, survey_id: str) -> dict:
        survey_path = os.path.join(SURVEY_DIR, f"{survey_id}.json")
        if os.path.exists(survey_path):
            os.remove(survey_path)
        return {"success": True}

    # ── 사용 가능한 템플릿 ────────────────────────────────────────────

    def list_templates(self) -> list[str]:
        if not os.path.exists(TEMPLATE_DIR):
            return []
        return [f for f in os.listdir(TEMPLATE_DIR) if f.endswith(".xlsx")]
