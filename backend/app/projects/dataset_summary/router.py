"""API router for Dataset Summary project."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session
from app.projects.dataset_summary.service import DatasetSummaryService

router = APIRouter()

_service = DatasetSummaryService()


@router.post("/summarize")
async def summarize(
    file: UploadFile = File(...),
    sheet: str | None = Form(default=None),
    org_name: str | None = Form(default=None),
    include_rows: bool = Form(default=False),
    mock: bool = Form(default=False),
    include_prompt: bool = Form(default=False),
    db: AsyncSession = Depends(get_db_session),
):
    if not org_name or not org_name.strip():
        raise HTTPException(status_code=400, detail="기관명(org_name)을 입력해주세요.")
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")

    data = await file.read()
    try:
        result = await _service.start_summarize_background(
            file_bytes=data,
            filename=file.filename,
            sheet=sheet,
            org_name=org_name,
            include_rows=include_rows,
            mock=mock,
            include_prompt=include_prompt,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result


@router.get("/summarize/progress/{execution_id}")
async def get_summarize_progress(
    execution_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.get_summarize_progress(execution_id, db=db)


# ── Execution history ────────────────────────────────────────────────────────

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
            filename=f"데이터셋설명키워드_{execution_id[:8]}.xlsx",
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
