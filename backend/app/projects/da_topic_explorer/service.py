"""Business logic service for DA Topic Explorer project."""

from __future__ import annotations

import json
import os
import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

# 프로젝트 디렉토리를 sys.path에 추가하여 src.xxx 임포트가 작동하도록 함
_PROJECT_DIR = Path(__file__).parent
if str(_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(_PROJECT_DIR))

# config의 base_dir을 data/ 하위로 오버라이드
os.environ.setdefault("ANALYSIS_PATHS__BASE_DIR", str(_PROJECT_DIR / "data"))

_DATA_DIR = _PROJECT_DIR / "data"
_INPUT_DIR = _DATA_DIR / "input"
_OUTPUT_DIR = _DATA_DIR / "output"
_REPORTS_DIR = _OUTPUT_DIR / "reports"

for d in [_INPUT_DIR / "institutions", _INPUT_DIR / "data_catalog", _INPUT_DIR / "analysis_cases",
          _DATA_DIR / "db", _REPORTS_DIR, _OUTPUT_DIR / "logs"]:
    d.mkdir(parents=True, exist_ok=True)

# 태스크 상태 관리
TASKS: dict[str, dict[str, Any]] = {}


def _get_latest_result_path() -> Path | None:
    if not _REPORTS_DIR.exists():
        return None
    result_files = list(_REPORTS_DIR.glob("phase2_result_*.json"))
    if not result_files:
        return None
    return max(result_files, key=lambda x: x.stat().st_mtime)


def _load_result(file_path: Path) -> dict:
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


class DATopicExplorerService:
    """공유데이터 분석주제 탐색 서비스."""

    # ── 최신 결과 ─────────────────────────────────────────────────────

    def get_latest_result(self) -> dict | None:
        path = _get_latest_result_path()
        if not path:
            return None
        try:
            data = _load_result(path)
            data["context"]["file_path"] = str(path)
            return data
        except Exception:
            return None

    # ── 파일 업로드 ───────────────────────────────────────────────────

    async def upload_files(
        self,
        institutions: list[dict],
    ) -> dict:
        """여러 기관의 프로파일 + 카탈로그 파일을 저장."""
        from werkzeug.utils import secure_filename as _secure

        uploaded_count = 0
        inst_dir_base = _INPUT_DIR / "institutions"
        catalog_dir = _INPUT_DIR / "data_catalog"

        for inst in institutions:
            name = inst["name"].strip()
            if not name:
                continue

            inst_dir = inst_dir_base / name
            inst_dir.mkdir(parents=True, exist_ok=True)

            for profile_content, profile_name in inst.get("profiles", []):
                with open(inst_dir / _secure(profile_name), "wb") as f:
                    f.write(profile_content)

            if inst.get("catalog_content"):
                ext = os.path.splitext(inst["catalog_name"])[1]
                with open(catalog_dir / f"{name}_메타데이터{ext}", "wb") as f:
                    f.write(inst["catalog_content"])

            uploaded_count += 1

        return {"status": "success", "message": f"총 {uploaded_count}건의 기관 자료가 업로드되었습니다."}

    # ── 파이프라인 실행 ───────────────────────────────────────────────

    def run_pipeline(self) -> dict:
        task_id = str(uuid.uuid4())
        TASKS[task_id] = {
            "status": "pending",
            "message": "작업 대기 중...",
            "start_time": datetime.now().isoformat(),
        }

        def _bg():
            try:
                TASKS[task_id]["status"] = "running"
                TASKS[task_id]["message"] = "Phase 1: 데이터 로딩 및 인덱싱 중..."

                from src.main import Phase1Pipeline
                p1 = Phase1Pipeline(rebuild=False)
                p1.run()

                TASKS[task_id]["message"] = "Phase 2: AI 에이전트 파이프라인 시작..."

                from src.agents.orchestrator import OrchestratorAgent
                p2 = OrchestratorAgent()

                original_log = p2._log_step
                def custom_log(agent_name, status, message=""):
                    original_log(agent_name, status, message)
                    TASKS[task_id]["message"] = f"{agent_name}: {status} {message}"
                p2._log_step = custom_log

                result = p2.run_pipeline()
                p2.save_results()

                TASKS[task_id]["status"] = "completed"
                TASKS[task_id]["result"] = {"status": result["status"], "context": p2.context}
                TASKS[task_id]["message"] = "모든 분석이 완료되었습니다."
            except Exception as e:
                TASKS[task_id]["status"] = "error"
                TASKS[task_id]["error"] = str(e)
                TASKS[task_id]["message"] = f"오류 발생: {str(e)}"

        t = threading.Thread(target=_bg, daemon=True)
        t.start()

        return {"status": "accepted", "task_id": task_id}

    # ── 계획서 생성 ───────────────────────────────────────────────────

    def generate_plans(self, selected_topic_ids: list[str], context_path: str) -> dict:
        if not os.path.exists(context_path):
            return {"status": "error", "error": "결과 파일을 찾을 수 없습니다."}

        if not selected_topic_ids:
            return {"status": "error", "error": "선택된 주제가 없습니다."}

        task_id = str(uuid.uuid4())
        TASKS[task_id] = {
            "status": "pending",
            "message": "계획서 생성 대기 중...",
            "start_time": datetime.now().isoformat(),
        }

        def _bg():
            try:
                TASKS[task_id]["status"] = "running"
                TASKS[task_id]["message"] = "계획서 기반 데이터 로드 중..."

                context_data = _load_result(Path(context_path)).get("context", {})
                topics = context_data.get("topic_discoverer", {}).get("topics", [])
                filtered = [t for t in topics if t.get("id") in selected_topic_ids]
                context_data["topic_discoverer"]["topics"] = filtered

                TASKS[task_id]["message"] = f"{len(filtered)}개의 주제에 대해 AI 분석 계획서 생성 중..."

                from src.agents.plan_generator import PlanGeneratorAgent
                agent = PlanGeneratorAgent(vector_store=None)
                result = agent.run(context_data)

                if result.success:
                    TASKS[task_id]["status"] = "completed"
                    TASKS[task_id]["result"] = {"status": "success", "plans": result.data.get("plans", [])}
                    TASKS[task_id]["message"] = "계획서 생성이 완료되었습니다."
                else:
                    TASKS[task_id]["status"] = "error"
                    TASKS[task_id]["error"] = result.error
                    TASKS[task_id]["message"] = f"생성 실패: {result.error}"
            except Exception as e:
                TASKS[task_id]["status"] = "error"
                TASKS[task_id]["error"] = str(e)
                TASKS[task_id]["message"] = f"오류 발생: {str(e)}"

        t = threading.Thread(target=_bg, daemon=True)
        t.start()

        return {"status": "accepted", "task_id": task_id}

    # ── 태스크 상태 ───────────────────────────────────────────────────

    def get_task_status(self, task_id: str) -> dict | None:
        return TASKS.get(task_id)

    # ── 기관 목록 ─────────────────────────────────────────────────────

    def list_institutions(self) -> list[str]:
        inst_dir = _INPUT_DIR / "institutions"
        if not inst_dir.exists():
            return []
        return [d.name for d in inst_dir.iterdir() if d.is_dir()]
