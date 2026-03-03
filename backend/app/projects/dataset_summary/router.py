"""API router for Dataset Summary project."""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.projects.dataset_summary.service import DatasetSummaryService

router = APIRouter()

_service = DatasetSummaryService()


@router.post("/summarize")
async def summarize(
    file: UploadFile = File(...),
    sheet: str | None = Form(default=None),
    group_key: str | None = Form(default=None),
    org_name: str | None = Form(default=None),
    include_rows: bool = Form(default=False),
    mock: bool = Form(default=False),
    include_prompt: bool = Form(default=False),
    include_debug: bool = Form(default=False),
    header_start: str | None = Form(default=None),
    header_end: str | None = Form(default=None),
):
    if not org_name or not org_name.strip():
        raise HTTPException(status_code=400, detail="기관명(org_name)을 입력해주세요.")
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")

    data = await file.read()
    try:
        result = await _service.summarize(
            file_bytes=data,
            filename=file.filename,
            sheet=sheet,
            group_key=group_key,
            org_name=org_name,
            include_rows=include_rows,
            mock=mock,
            include_prompt=include_prompt,
            include_debug=include_debug,
            header_start=header_start,
            header_end=header_end,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result


@router.get("/stats")
async def get_stats():
    return await _service.get_stats()
