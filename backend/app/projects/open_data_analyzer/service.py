"""Business logic service for Open Data Analyzer project."""

from __future__ import annotations

import asyncio
import os
import tempfile
import uuid
from typing import Any, Dict, List

from app.projects.open_data_analyzer.core import (
    GEMINI_BASE_URL,
    GEMINI_MODEL,
    SimpleTable,
    calculate_confidence,
    extract_tables_from_excel,
    find_matching_table,
    merge_table_data,
    normalize_table_key,
    run_stage1,
    run_stage2,
    run_stage3,
    run_stage4,
    run_stage5,
)
from app.projects.open_data_analyzer.reasons import REASONS
from app.projects.open_data_analyzer.schemas import AnalyzerStats

# 고정 서버 설정
FIXED_SLEEP_SECONDS = 1.0

# 세션 저장소
SESSIONS: Dict[str, Dict[str, Any]] = {}


def _save_upload_bytes(data: bytes, suffix: str) -> str:
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    handle.write(data)
    handle.flush()
    handle.close()
    return handle.name


def _build_stage1_rows(
    tables: Dict[str, SimpleTable],
    stage1: Dict[str, Dict[str, Any]],
    file_sources: Dict[str, str] | None = None,
) -> List[Dict[str, Any]]:
    rows = []
    for key, table in tables.items():
        s1 = stage1.get(key, {})
        table_display = table.table_kr or table.table_en or table.key
        quality_info = calculate_confidence(table.table_kr, table.table_en, table.columns)

        row = {
            "table": table_display,
            "key": key,
            "openable": s1.get("openable", ""),
            "reason_numbers": s1.get("reason_numbers", []),
            "reason_text": s1.get("reason_text", ""),
            "confidence": quality_info["confidence"],
            "has_columns": quality_info["has_columns"],
            "column_count": quality_info["column_count"],
            "data_quality": quality_info["data_quality"],
        }

        if file_sources and key in file_sources:
            row["source_file"] = file_sources[key]
        if hasattr(table, "file_sources") and isinstance(table.file_sources, list):
            row["file_sources"] = table.file_sources

        rows.append(row)
    return rows


def _build_stage2_rows(
    tables: Dict[str, SimpleTable], stage2: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    rows = []
    for key, table in tables.items():
        s2 = stage2.get(key)
        if not s2:
            continue
        table_display = table.table_kr or table.table_en or table.key
        rows.append({"table": table_display, "key": key, "subject_area": s2.get("subject_area", "")})
    return rows


def _build_stage3_rows(
    tables: Dict[str, SimpleTable], stage3: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    rows = []
    for key, table in tables.items():
        s3 = stage3.get(key)
        if not s3:
            continue
        table_display = table.table_kr or table.table_en or table.key
        rows.append({
            "table": table_display,
            "key": key,
            "core_columns": s3.get("core_columns", []),
            "dataset_description": s3.get("dataset_description", ""),
        })
    return rows


def _build_stage4_rows(
    tables: Dict[str, SimpleTable], joins: Dict[str, List[Dict[str, Any]]]
) -> List[Dict[str, Any]]:
    rows = []
    for key, table in tables.items():
        for join in joins.get(key, []):
            table_display = table.table_kr or table.table_en or table.key
            rows.append({
                "table": table_display,
                "key": key,
                "join_table": join.get("table_b", ""),
                "join_keys": join.get("join_keys", []),
            })
    return rows


def _build_stage5_rows(
    tables: Dict[str, SimpleTable], stage5: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    rows = []
    for key, table in tables.items():
        s5 = stage5.get(key)
        if not s5:
            continue
        table_display = table.table_kr or table.table_en or table.key
        rows.append({
            "table": table_display,
            "key": key,
            "dataset_name": s5.get("dataset_name", ""),
            "final_columns": s5.get("final_columns", []),
            "final_openable": s5.get("final_openable", ""),
            "final_reason": s5.get("final_reason", ""),
        })
    return rows


class OpenDataAnalyzerService:
    """Service for analyzing open data eligibility."""

    def _get_api_key(self) -> str | None:
        return os.environ.get("GEMINI_API_KEY")

    def _get_base_url(self) -> str:
        return os.environ.get("GEMINI_BASE_URL", GEMINI_BASE_URL)

    def _get_model(self) -> str:
        return os.environ.get("GEMINI_MODEL", GEMINI_MODEL)

    async def run_stage1(
        self,
        files_data: List[tuple[bytes, str]],
        session_id: str | None = None,
        mock: bool = False,
    ) -> dict:
        api_key = self._get_api_key()
        if not api_key and not mock:
            raise ValueError("Missing GEMINI_API_KEY.")

        if session_id and session_id in SESSIONS:
            state = SESSIONS[session_id]
            tables = state["tables"]
        else:
            if not files_data:
                raise ValueError("At least one file is required.")

            all_tables: Dict[str, SimpleTable] = {}
            file_sources: Dict[str, str] = {}

            for file_bytes, filename in files_data:
                suffix = "." + filename.rsplit(".", 1)[-1] if "." in filename else ".xlsx"
                tmp_path = _save_upload_bytes(file_bytes, suffix)

                try:
                    file_tables = await asyncio.to_thread(
                        extract_tables_from_excel, tmp_path, None
                    )

                    for orig_key, table in file_tables.items():
                        norm_key = normalize_table_key(table.table_kr, table.table_en)
                        matched_key = find_matching_table(norm_key, all_tables)

                        if matched_key:
                            table_dict = {
                                "key": orig_key,
                                "table_kr": table.table_kr,
                                "table_en": table.table_en,
                                "columns": table.columns,
                            }
                            existing_table = all_tables[matched_key]
                            existing_dict = {
                                "key": existing_table.key,
                                "table_kr": existing_table.table_kr,
                                "table_en": existing_table.table_en,
                                "columns": existing_table.columns,
                                "file_sources": getattr(
                                    existing_table, "file_sources",
                                    [file_sources.get(matched_key, "")]
                                ),
                            }
                            merged = merge_table_data(existing_dict, table_dict, filename)
                            merged_table = SimpleTable(
                                key=merged["key"],
                                table_kr=merged["table_kr"],
                                table_en=merged["table_en"],
                                columns=merged["columns"],
                            )
                            merged_table.file_sources = merged["file_sources"]
                            all_tables[matched_key] = merged_table
                        else:
                            table.file_sources = [filename]
                            all_tables[norm_key] = table
                            file_sources[norm_key] = filename
                finally:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass

            tables = all_tables
            session_id = uuid.uuid4().hex
            SESSIONS[session_id] = {
                "tables": tables,
                "file_sources": file_sources,
                "reasons": REASONS,
                "stage1": {},
                "stage2": {},
                "stage3": {},
                "joins": {},
                "stage5": {},
            }
            state = SESSIONS[session_id]

        stage1 = await asyncio.to_thread(
            run_stage1,
            tables,
            state.get("reasons", REASONS),
            api_key,
            self._get_base_url(),
            self._get_model(),
            FIXED_SLEEP_SECONDS,
            mock,
        )

        state["stage1"].update(stage1)
        file_sources = state.get("file_sources", {})
        rows = _build_stage1_rows(tables, stage1, file_sources)

        openable_count = sum(1 for r in stage1.values() if r.get("openable") == "가능")
        not_openable_count = sum(1 for r in stage1.values() if r.get("openable") == "불가능")

        return {
            "session_id": session_id,
            "stage": 1,
            "rows": rows,
            "total": len(tables),
            "openable_count": openable_count,
            "not_openable_count": not_openable_count,
            "file_count": len(file_sources) if file_sources else 1,
        }

    async def run_stage2(self, session_id: str, mock: bool = False) -> dict:
        if session_id not in SESSIONS:
            raise ValueError("Invalid session_id.")
        api_key = self._get_api_key()
        if not api_key and not mock:
            raise ValueError("Missing GEMINI_API_KEY.")

        state = SESSIONS[session_id]
        if not state.get("stage1"):
            raise ValueError("Run stage 1 first.")

        tables = state["tables"]
        stage1 = state["stage1"]

        stage2 = await asyncio.to_thread(
            run_stage2,
            tables,
            api_key,
            self._get_base_url(),
            self._get_model(),
            FIXED_SLEEP_SECONDS,
            mock,
            stage1_results=stage1,
        )

        state["stage2"].update(stage2)
        rows = _build_stage2_rows(tables, stage2)

        return {
            "session_id": session_id,
            "stage": 2,
            "rows": rows,
            "total": len(stage2),
        }

    async def run_stage3(self, session_id: str, mock: bool = False) -> dict:
        if session_id not in SESSIONS:
            raise ValueError("Invalid session_id.")
        api_key = self._get_api_key()
        if not api_key and not mock:
            raise ValueError("Missing GEMINI_API_KEY.")

        state = SESSIONS[session_id]
        if not state.get("stage1"):
            raise ValueError("Run stage 1 first.")

        tables = state["tables"]
        stage1 = state["stage1"]

        stage3 = await asyncio.to_thread(
            run_stage3,
            tables,
            api_key,
            self._get_base_url(),
            self._get_model(),
            FIXED_SLEEP_SECONDS,
            mock,
            stage1_results=stage1,
        )

        state["stage3"].update(stage3)
        rows = _build_stage3_rows(tables, stage3)

        total_columns = sum(len(r.get("core_columns", [])) for r in stage3.values())

        return {
            "session_id": session_id,
            "stage": 3,
            "rows": rows,
            "total": len(stage3),
            "total_columns": total_columns,
        }

    async def run_stage4(self, session_id: str, mock: bool = False) -> dict:
        if session_id not in SESSIONS:
            raise ValueError("Invalid session_id.")
        api_key = self._get_api_key()
        if not api_key and not mock:
            raise ValueError("Missing GEMINI_API_KEY.")

        state = SESSIONS[session_id]
        if not state.get("stage2"):
            raise ValueError("Run stage 2 first.")

        tables = state["tables"]
        stage2 = state["stage2"]

        joins = await asyncio.to_thread(
            run_stage4,
            tables,
            api_key,
            self._get_base_url(),
            self._get_model(),
            FIXED_SLEEP_SECONDS,
            mock,
            stage2_results=stage2,
        )

        state["joins"].update(joins)
        rows = _build_stage4_rows(tables, joins)

        join_pairs = sum(len(v) for v in joins.values())

        return {
            "session_id": session_id,
            "stage": 4,
            "rows": rows,
            "total": join_pairs,
        }

    async def run_stage5(self, session_id: str, mock: bool = False) -> dict:
        if session_id not in SESSIONS:
            raise ValueError("Invalid session_id.")
        api_key = self._get_api_key()
        if not api_key and not mock:
            raise ValueError("Missing GEMINI_API_KEY.")

        state = SESSIONS[session_id]
        if not state.get("stage3"):
            raise ValueError("Run stage 3 first.")

        tables = state["tables"]
        stage1 = state["stage1"]
        stage2 = state.get("stage2", {})
        stage3 = state.get("stage3", {})
        joins = state.get("joins", {})

        stage5 = await asyncio.to_thread(
            run_stage5,
            tables,
            api_key,
            self._get_base_url(),
            self._get_model(),
            FIXED_SLEEP_SECONDS,
            mock,
            stage1_results=stage1,
            stage2_results=stage2,
            stage3_results=stage3,
            joins_results=joins,
        )

        state["stage5"].update(stage5)
        rows = _build_stage5_rows(tables, stage5)

        final_openable = sum(1 for r in stage5.values() if r.get("final_openable") == "가능")
        final_not_openable = sum(1 for r in stage5.values() if r.get("final_openable") == "불가능")

        return {
            "session_id": session_id,
            "stage": 5,
            "rows": rows,
            "total": len(stage5),
            "final_openable": final_openable,
            "final_not_openable": final_not_openable,
        }

    async def export_excel(self, session_id: str) -> str:
        if session_id not in SESSIONS:
            raise ValueError("Invalid session_id.")

        from openpyxl import Workbook

        state = SESSIONS[session_id]
        tables = state["tables"]
        stage1 = state.get("stage1", {})
        stage2 = state.get("stage2", {})
        stage3 = state.get("stage3", {})
        joins = state.get("joins", {})
        stage5 = state.get("stage5", {})

        def _build_workbook() -> str:
            wb = Workbook()
            wb.remove(wb.active)

            ws1 = wb.create_sheet("1단계_개방가능여부")
            ws1.append(["테이블명(한글)", "테이블명(영문)", "개방가능여부", "불가능사유번호", "판단사유"])
            for key, table in tables.items():
                s1 = stage1.get(key, {})
                ws1.append([
                    table.table_kr, table.table_en, s1.get("openable", ""),
                    ",".join(str(x) for x in s1.get("reason_numbers", [])),
                    s1.get("reason_text", ""),
                ])

            ws2 = wb.create_sheet("2단계_주제영역")
            ws2.append(["테이블명(한글)", "테이블명(영문)", "주제영역"])
            for key, table in tables.items():
                s2 = stage2.get(key, {})
                if s2:
                    ws2.append([table.table_kr, table.table_en, s2.get("subject_area", "")])

            ws3 = wb.create_sheet("3단계_개방데이터셋")
            ws3.append(["테이블명(한글)", "테이블명(영문)", "핵심컬럼", "데이터셋설명"])
            for key, table in tables.items():
                s3 = stage3.get(key, {})
                if s3:
                    ws3.append([
                        table.table_kr, table.table_en,
                        ",".join(s3.get("core_columns", [])),
                        s3.get("dataset_description", ""),
                    ])

            ws4 = wb.create_sheet("4단계_조인검토")
            ws4.append(["테이블명(한글)", "테이블명(영문)", "조인가능테이블", "조인키"])
            for key, table in tables.items():
                for join in joins.get(key, []):
                    ws4.append([
                        table.table_kr, table.table_en,
                        join.get("table_b", ""),
                        ",".join(join.get("join_keys", [])),
                    ])

            ws5 = wb.create_sheet("5단계_최종점검")
            ws5.append(["테이블명(한글)", "테이블명(영문)", "개방데이터셋명", "최종컬럼", "최종개방여부", "판정사유"])
            for key, table in tables.items():
                s5 = stage5.get(key, {})
                if s5:
                    ws5.append([
                        table.table_kr, table.table_en,
                        s5.get("dataset_name", ""),
                        ",".join(s5.get("final_columns", [])),
                        s5.get("final_openable", ""),
                        s5.get("final_reason", ""),
                    ])

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
            wb.save(temp_file.name)
            temp_file.close()
            return temp_file.name

        return await asyncio.to_thread(_build_workbook)

    async def get_stats(self) -> AnalyzerStats:
        return AnalyzerStats(
            active_sessions=len(SESSIONS),
            supported_formats=[".xlsx"],
            mock_available=True,
            stages=["1단계: 개방가능 여부", "2단계: 주제영역", "3단계: 핵심컬럼", "4단계: 조인검토", "5단계: 최종점검"],
        )
