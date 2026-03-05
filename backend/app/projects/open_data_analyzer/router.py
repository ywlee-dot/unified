"""API router for Open Data Analyzer project."""

import os
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.projects.open_data_analyzer.service import OpenDataAnalyzerService

router = APIRouter()

_service = OpenDataAnalyzerService()


@router.post("/stage1")
async def stage1(
    session_id: str | None = Form(default=None),
    columns_files: List[UploadFile] = File(None),
    mock: bool = Form(default=False),
):
    try:
        files_data = []
        if columns_files:
            for f in columns_files:
                data = await f.read()
                files_data.append((data, f.filename or "upload.xlsx"))

        result = await _service.run_stage1(
            files_data=files_data,
            session_id=session_id,
            mock=mock,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stage2")
async def stage2(
    session_id: str = Form(...),
    mock: bool = Form(default=False),
):
    try:
        return await _service.run_stage2(session_id=session_id, mock=mock)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stage3")
async def stage3(
    session_id: str = Form(...),
    mock: bool = Form(default=False),
):
    try:
        return await _service.run_stage3(session_id=session_id, mock=mock)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stage4")
async def stage4(
    session_id: str = Form(...),
    mock: bool = Form(default=False),
):
    try:
        return await _service.run_stage4(session_id=session_id, mock=mock)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stage5")
async def stage5(
    session_id: str = Form(...),
    mock: bool = Form(default=False),
):
    try:
        return await _service.run_stage5(session_id=session_id, mock=mock)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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


@router.get("/stats")
async def get_stats():
    return await _service.get_stats()
