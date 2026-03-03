"""Business logic service for Dataset Summary project."""

from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, List

from app.projects.dataset_summary.core import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    generate_mock_summaries,
    generate_summaries,
    read_csv_rows_from_bytes,
    read_rows_from_bytes,
)
from app.projects.dataset_summary.schemas import DatasetSummaryStats


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
    ) -> dict:
        use_mock = mock or os.environ.get("MOCK_MODE") == "1"
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")
        if not api_key and not use_mock:
            raise ValueError("Missing GEMINI_API_KEY/OPENAI_API_KEY.")

        header_range = (header_start, header_end) if header_start and header_end else None
        header_debug: Dict[str, Any] | None = None

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

        if include_debug:
            return {"results": results, "debug": header_debug}
        return {"results": results}

    async def get_stats(self) -> DatasetSummaryStats:
        return DatasetSummaryStats(
            total_generated=0,
            mock_available=True,
            supported_formats=[".xlsx", ".csv"],
        )
