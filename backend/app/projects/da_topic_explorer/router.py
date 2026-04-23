"""API router for DA Topic Explorer project."""

import os

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from typing import List

from .service import DATopicExplorerService

router = APIRouter()

_service = DATopicExplorerService()


@router.get("/latest-result")
def get_latest_result():
    """가장 최근 Phase 2 분석 결과를 반환."""
    result = _service.get_latest_result()
    if not result:
        return {"context": None}
    return result


@router.post("/upload")
async def upload_files(
    inst_names: List[str] = Form(..., alias="instName[]"),
):
    """여러 기관 동시 파일 업로드. (프론트엔드에서 FormData로 전송)"""
    from starlette.requests import Request
    # Note: 복합 파일 업로드는 프론트엔드에서 FormData로 처리
    # 간소화된 단일 기관 업로드도 지원
    return {"status": "success", "message": f"{len(inst_names)}건 기관명 수신. 파일 업로드는 개별 엔드포인트를 사용하세요."}


@router.post("/upload-institution")
async def upload_institution(
    institution_name: str = Form(...),
    profile_files: List[UploadFile] = File(None),
    catalog_file: UploadFile | None = File(None),
):
    """단일 기관의 프로파일 + 카탈로그 파일 업로드."""
    institutions = []
    profiles = []
    if profile_files:
        for pf in profile_files:
            if pf.filename:
                content = await pf.read()
                profiles.append((content, pf.filename))

    catalog_content = None
    catalog_name = ""
    if catalog_file and catalog_file.filename:
        catalog_content = await catalog_file.read()
        catalog_name = catalog_file.filename

    institutions.append({
        "name": institution_name,
        "profiles": profiles,
        "catalog_content": catalog_content,
        "catalog_name": catalog_name,
    })

    try:
        result = await _service.upload_files(institutions)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/institutions")
def list_institutions():
    """등록된 기관 목록."""
    return {"institutions": _service.list_institutions()}


@router.post("/run-pipeline")
def run_pipeline():
    """Phase 1 + Phase 2 파이프라인 비동기 실행."""
    return _service.run_pipeline()


@router.post("/generate-plans")
def generate_plans(body: dict):
    """선택된 주제에 대해 분석 계획서 생성."""
    selected_ids = body.get("selected_topic_ids", [])
    context_path = body.get("context_path", "")
    result = _service.generate_plans(selected_ids, context_path)
    if result.get("status") == "error":
        raise HTTPException(400, result.get("error"))
    return result


@router.get("/task-status/{task_id}")
def get_task_status(task_id: str):
    """태스크 진행 상태 조회."""
    task = _service.get_task_status(task_id)
    if not task:
        raise HTTPException(404, "태스크를 찾을 수 없습니다.")
    return task
