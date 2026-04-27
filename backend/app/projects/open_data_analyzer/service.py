"""Business logic service for Open Data Analyzer project."""

from __future__ import annotations

import asyncio
import os
import tempfile
import uuid
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from typing import Any, Dict, List

from sqlalchemy.ext.asyncio import AsyncSession

from app.projects.open_data_analyzer.core import (
    GEMINI_BASE_URL,
    GEMINI_MODEL,
    STANDARD_CATEGORIES,
    SimpleTable,
    extract_tables_from_excel,
    find_matching_table,
    merge_table_data,
    normalize_table_key,
    run_stage1,
)
from app.projects.open_data_analyzer.reasons import REASONS
from app.projects.open_data_analyzer.schemas import AnalyzerStats
from app.shared.services.execution_recorder import (
    ExecutionRecorder,
    serialize_execution,
)

PROJECT_SLUG = "open_data_analyzer"
FIXED_SLEEP_SECONDS = 1.0

SESSIONS: Dict[str, Dict[str, Any]] = {}


def _save_upload_bytes(data: bytes, suffix: str) -> str:
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    handle.write(data)
    handle.flush()
    handle.close()
    return handle.name


def _snap_to_standard(label: str, threshold: float = 0.82) -> str:
    best_ratio, best_cat = 0.0, label
    for cat in STANDARD_CATEGORIES:
        r = SequenceMatcher(None, label, cat).ratio()
        if r > best_ratio:
            best_ratio, best_cat = r, cat
    return best_cat if best_ratio >= threshold else label


def _consolidate_major_areas(stage1: Dict[str, Dict[str, Any]]) -> None:
    """In-place: snap major_area to nearest standard, then merge near-duplicates."""
    for s1 in stage1.values():
        ma = s1.get("major_area", "")
        if ma:
            s1["major_area"] = _snap_to_standard(ma)

    freq = Counter(s1.get("major_area", "") for s1 in stage1.values() if s1.get("major_area"))
    label_map: Dict[str, str] = {}
    for label in freq:
        if label in STANDARD_CATEGORIES:
            label_map[label] = label
            continue
        best_ratio, best_target = 0.0, label
        for other in freq:
            if other == label:
                continue
            r = SequenceMatcher(None, label, other).ratio()
            if r > best_ratio:
                best_ratio, best_target = r, other
        label_map[label] = best_target if best_ratio >= 0.82 and freq[best_target] >= freq[label] else label

    for s1 in stage1.values():
        ma = s1.get("major_area", "")
        if ma in label_map:
            s1["major_area"] = label_map[ma]


def _build_analysis_result(
    tables: Dict[str, SimpleTable],
    stage1: Dict[str, Dict[str, Any]],
    file_sources: Dict[str, str] | None = None,
) -> tuple[list, list]:
    """Returns (groups, not_openable). Groups are sorted by major_area."""
    group_map: Dict[str, list] = defaultdict(list)
    not_openable: list = []

    for key, table in tables.items():
        s1 = stage1.get(key, {})
        if not s1:
            continue
        table_display = table.table_kr or table.table_en or key
        row: Dict[str, Any] = {
            "table": table_display,
            "key": key,
            "bucket": s1.get("bucket", ""),
            "open_columns": s1.get("open_columns", []),
            "closed_columns": s1.get("closed_columns", []),
            "open_count": s1.get("open_count", 0),
            "total_count": s1.get("total_count", len(table.columns)),
            "major_area": s1.get("major_area", ""),
            "sub_area": s1.get("sub_area", ""),
            "dataset_name": s1.get("dataset_name", ""),
        }
        if file_sources and key in file_sources:
            row["source_file"] = file_sources[key]

        bucket = s1.get("bucket", "")
        if bucket in ("전체개방", "부분개방"):
            major = s1.get("major_area") or "미분류"
            group_map[major].append(row)
        else:
            not_openable.append(row)

    groups = [
        {"major_area": major, "tables": rows}
        for major, rows in sorted(group_map.items())
    ]
    return groups, not_openable


def _serialize_tables(tables: Dict[str, SimpleTable]) -> Dict[str, Dict[str, Any]]:
    return {
        key: {
            "key": t.key,
            "table_kr": t.table_kr,
            "table_en": t.table_en,
            "columns": list(t.columns),
            "file_sources": list(getattr(t, "file_sources", []) or []),
        }
        for key, t in tables.items()
    }


def _build_excel_workbook(
    tables_serialized: Dict[str, Dict[str, Any]],
    stage1: Dict[str, Dict[str, Any]],
) -> str:
    from openpyxl import Workbook

    wb = Workbook()
    wb.remove(wb.active)

    ws_open = wb.create_sheet("개방가능_데이터셋")
    ws_open.append([
        "주제(대분류)", "주제(소분류)", "테이블명(한글)", "테이블명(영문)",
        "판정", "데이터셋명", "개방가능컬럼수", "전체컬럼수",
        "개방가능컬럼", "제외컬럼(사유)",
    ])
    for key, table_dict in tables_serialized.items():
        s1 = stage1.get(key, {})
        if s1.get("bucket") not in ("전체개방", "부분개방"):
            continue
        closed_str = "; ".join(
            f"{c['name']}({c['reason']})" for c in s1.get("closed_columns", [])
        )
        ws_open.append([
            s1.get("major_area", ""),
            s1.get("sub_area", ""),
            table_dict.get("table_kr", ""),
            table_dict.get("table_en", ""),
            s1.get("bucket", ""),
            s1.get("dataset_name", ""),
            s1.get("open_count", 0),
            s1.get("total_count", 0),
            ",".join(s1.get("open_columns", [])),
            closed_str,
        ])

    ws_no = wb.create_sheet("개방불가_목록")
    ws_no.append(["테이블명(한글)", "테이블명(영문)", "제외컬럼(사유)"])
    for key, table_dict in tables_serialized.items():
        s1 = stage1.get(key, {})
        if s1.get("bucket") != "불가능":
            continue
        closed_str = "; ".join(
            f"{c['name']}({c['reason']})" for c in s1.get("closed_columns", [])
        )
        ws_no.append([
            table_dict.get("table_kr", ""),
            table_dict.get("table_en", ""),
            closed_str,
        ])

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    wb.save(temp_file.name)
    temp_file.close()
    return temp_file.name


class OpenDataAnalyzerService:

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
        db: AsyncSession | None = None,
    ) -> dict:
        api_key = self._get_api_key()
        if not api_key and not mock:
            raise ValueError("Missing GEMINI_API_KEY.")

        new_file_names = [name for _, name in files_data]
        is_new_session = not (session_id and session_id in SESSIONS)

        if not is_new_session:
            state = SESSIONS[session_id]
            tables = state["tables"]
            file_sources = state.get("file_sources", {})
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
                            existing = all_tables[matched_key]
                            merged = merge_table_data(
                                {
                                    "key": existing.key,
                                    "table_kr": existing.table_kr,
                                    "table_en": existing.table_en,
                                    "columns": existing.columns,
                                    "file_sources": getattr(existing, "file_sources", [file_sources.get(matched_key, "")]),
                                },
                                {"key": orig_key, "table_kr": table.table_kr, "table_en": table.table_en, "columns": table.columns},
                                filename,
                            )
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
                "stage1": {},
            }
            state = SESSIONS[session_id]

        execution = None
        if db is not None:
            summary = (
                ", ".join(new_file_names)
                if new_file_names
                else f"세션 재실행 ({session_id[:8]})"
            )
            execution = await ExecutionRecorder.create(
                db,
                project_slug=PROJECT_SLUG,
                process_type="inprocess",
                input_metadata={
                    "file_names": new_file_names,
                    "mock": mock,
                    "session_id": session_id,
                    "is_new_session": is_new_session,
                },
                input_summary=summary,
            )

        try:
            stage1 = await asyncio.to_thread(
                run_stage1,
                tables,
                REASONS,
                api_key,
                self._get_base_url(),
                self._get_model(),
                FIXED_SLEEP_SECONDS,
                mock,
            )

            _consolidate_major_areas(stage1)
            state["stage1"].update(stage1)

            groups, not_openable = _build_analysis_result(tables, stage1, file_sources)

            full_open_count = sum(1 for r in stage1.values() if r.get("bucket") == "전체개방")
            partial_count = sum(1 for r in stage1.values() if r.get("bucket") == "부분개방")
            not_open_count = sum(1 for r in stage1.values() if r.get("bucket") == "불가능")

            response = {
                "session_id": session_id,
                "total": len(tables),
                "full_open_count": full_open_count,
                "partial_count": partial_count,
                "not_openable_count": not_open_count,
                "file_count": len(file_sources) if file_sources else 1,
                "groups": groups,
                "not_openable": not_openable,
            }

            if db is not None and execution is not None:
                snapshot = {
                    "response": response,
                    "raw": {
                        "tables": _serialize_tables(tables),
                        "stage1": state["stage1"],
                        "file_sources": file_sources,
                    },
                }
                await ExecutionRecorder.mark_succeeded(
                    db,
                    execution_id=execution.execution_id,
                    result_data=snapshot,
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

    async def export_excel(self, session_id: str) -> str:
        if session_id not in SESSIONS:
            raise ValueError("Invalid session_id.")
        state = SESSIONS[session_id]
        tables = state["tables"]
        stage1 = state.get("stage1", {})
        return await asyncio.to_thread(
            _build_excel_workbook, _serialize_tables(tables), stage1
        )

    async def export_excel_from_execution(
        self,
        db: AsyncSession,
        execution_id: str,
    ) -> str:
        record = await ExecutionRecorder.get(db, execution_id)
        if record is None or record.project_slug != PROJECT_SLUG:
            raise ValueError("Invalid execution_id.")
        if record.status != "succeeded" or not record.result_data:
            raise ValueError("Execution has no result to export.")

        raw = record.result_data.get("raw", {})
        tables_serialized = raw.get("tables", {})
        stage1 = raw.get("stage1", {})

        return await asyncio.to_thread(
            _build_excel_workbook, tables_serialized, stage1
        )

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

    async def get_stats(self) -> AnalyzerStats:
        return AnalyzerStats(
            active_sessions=len(SESSIONS),
            supported_formats=[".xlsx"],
            mock_available=True,
            stages=["1단계: 컬럼 단위 개방 가능 여부 판단 + 주제분류 + 데이터셋명"],
        )
