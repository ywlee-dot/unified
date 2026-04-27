"""API router for Open Data Analyzer project."""

import logging
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session
from app.projects.open_data_analyzer.service import OpenDataAnalyzerService

logger = logging.getLogger(__name__)
router = APIRouter()

_service = OpenDataAnalyzerService()


@router.post("/stage1")
async def stage1(
    session_id: str | None = Form(default=None),
    columns_files: List[UploadFile] = File(None),
    mock: bool = Form(default=False),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        files_data = []
        if columns_files:
            for f in columns_files:
                data = await f.read()
                files_data.append((data, f.filename or "upload.xlsx"))

        result = await _service.start_stage1_background(
            files_data=files_data,
            session_id=session_id,
            mock=mock,
            db=db,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("stage1 failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/stage1/progress/{execution_id}")
async def get_stage1_progress(
    execution_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.get_stage1_progress(execution_id, db=db)


@router.post("/export")
async def export(session_id: str = Form(...)):
    try:
        file_path = await _service.export_excel(session_id=session_id)
        return FileResponse(
            file_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"개방데이터분석결과_{session_id[:8]}.xlsx",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/runs")
async def list_runs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.list_executions(db, page=page, page_size=page_size)


@router.get("/runs/{execution_id}")
async def get_run(
    execution_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    record = await _service.get_execution(db, execution_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Execution not found.")
    return record


@router.get("/runs/{execution_id}/export")
async def export_run(
    execution_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        file_path = await _service.export_excel_from_execution(db, execution_id)
        return FileResponse(
            file_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"개방데이터분석결과_{execution_id[:8]}.xlsx",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/runs/{execution_id}")
async def delete_run(
    execution_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    deleted = await _service.delete_execution(db, execution_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Execution not found.")
    return {"deleted": True}


@router.get("/stats")
async def get_stats():
    return await _service.get_stats()
