"""Business logic service for Dataset Summary project."""

from __future__ import annotations

import asyncio
import os
from typing import Any, Dict

from sqlalchemy.ext.asyncio import AsyncSession

from app.projects.dataset_summary.core import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    generate_mock_summaries,
    generate_summaries,
    read_csv_rows_from_bytes,
    read_rows_from_bytes,
)
from app.projects.dataset_summary.schemas import DatasetSummaryStats
from app.shared.services.execution_recorder import (
    ExecutionRecorder,
    serialize_execution,
)

PROJECT_SLUG = "dataset_summary"


class DatasetSummaryService:
    """Service for generating dataset summaries via LLM."""

    async def summarize(
        self,
        file_bytes: bytes,
        filename: str,
        sheet: str | None = None,
        group_key: str | None = None,
        org_name: str | None = None,
        include_rows: bool = False,
        mock: bool = False,
        include_prompt: bool = False,
        include_debug: bool = False,
        header_start: str | None = None,
        header_end: str | None = None,
        db: AsyncSession | None = None,
    ) -> dict:
        use_mock = mock or os.environ.get("MOCK_MODE") == "1"
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")
        if not api_key and not use_mock:
            raise ValueError("Missing GEMINI_API_KEY/OPENAI_API_KEY.")

        header_range = (header_start, header_end) if header_start and header_end else None
        header_debug: Dict[str, Any] | None = None

        execution = None
        if db is not None:
            execution = await ExecutionRecorder.create(
                db,
                project_slug=PROJECT_SLUG,
                process_type="inprocess",
                input_metadata={
                    "filename": filename,
                    "sheet": sheet,
                    "group_key": group_key,
                    "org_name": org_name,
                    "mock": use_mock,
                    "header_range": [header_start, header_end] if header_range else None,
                },
                input_summary=f"{org_name or '-'} · {filename}",
            )

        try:
            if filename.endswith(".xlsx"):
                if include_debug:
                    rows, header_debug = await asyncio.to_thread(
                        read_rows_from_bytes, file_bytes, sheet,
                        header_range=header_range, return_debug=True,
                    )
                else:
                    rows = await asyncio.to_thread(
                        read_rows_from_bytes, file_bytes, sheet,
                        header_range=header_range,
                    )
            elif filename.endswith(".csv"):
                if include_debug:
                    rows, header_debug = await asyncio.to_thread(
                        read_csv_rows_from_bytes, file_bytes,
                        header_range=header_range, return_debug=True,
                    )
                else:
                    rows = await asyncio.to_thread(
                        read_csv_rows_from_bytes, file_bytes,
                        header_range=header_range,
                    )
            else:
                raise ValueError("Only .xlsx or .csv files are supported.")

            if not rows:
                raise ValueError("No rows found.")

            if use_mock:
                results = await asyncio.to_thread(
                    generate_mock_summaries,
                    rows, group_key,
                    include_rows=include_rows,
                    include_prompt=include_prompt,
                    org_name=org_name,
                    header_debug=header_debug if include_debug else None,
                )
            else:
                results = await asyncio.to_thread(
                    generate_summaries,
                    rows, group_key,
                    DEFAULT_BASE_URL, api_key, DEFAULT_MODEL,
                    include_rows=include_rows,
                    include_prompt=include_prompt,
                    org_name=org_name,
                    header_debug=header_debug if include_debug else None,
                )

            response: Dict[str, Any] = {"results": results}
            if include_debug:
                response["debug"] = header_debug

            if db is not None and execution is not None:
                await ExecutionRecorder.mark_succeeded(
                    db,
                    execution_id=execution.execution_id,
                    result_data={
                        "response": response,
                        "options": {
                            "include_rows": include_rows,
                            "include_prompt": include_prompt,
                            "include_debug": include_debug,
                        },
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

    async def get_stats(self) -> DatasetSummaryStats:
        return DatasetSummaryStats(
            total_generated=0,
            mock_available=True,
            supported_formats=[".xlsx", ".csv"],
        )
