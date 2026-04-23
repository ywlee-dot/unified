"""API router for Survey Platform project."""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .service import SurveyPlatformService

router = APIRouter()

_service = SurveyPlatformService()


# ── 템플릿 ────────────────────────────────────────────────────────────────────

@router.get("/templates")
def list_templates():
    """사용 가능한 설문 템플릿 목록."""
    return {"templates": _service.list_templates()}


# ── 설문 CRUD ─────────────────────────────────────────────────────────────────

@router.get("/surveys")
def list_surveys():
    """설문 목록 조회."""
    return {"surveys": _service.list_surveys()}


@router.get("/surveys/{survey_id}")
def get_survey(survey_id: str):
    """설문 상세 조회."""
    data = _service.get_survey(survey_id)
    if not data:
        raise HTTPException(404, "설문을 찾을 수 없습니다.")
    return data


@router.post("/surveys")
async def create_survey(
    survey_type: str = Form(...),
    institution_name: str = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    data_file: UploadFile | None = File(None),
):
    """설문 생성."""
    try:
        file_content = None
        file_name = ""
        if data_file and data_file.filename:
            file_content = await data_file.read()
            file_name = data_file.filename
        result = await _service.create_survey(
            survey_type, institution_name, start_date, end_date,
            file_content, file_name,
        )
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@router.put("/surveys/{survey_id}")
def update_survey(
    survey_id: str,
    institution_name: str = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
):
    """설문 메타데이터 수정."""
    result = _service.update_survey(survey_id, institution_name, start_date, end_date)
    if not result["success"]:
        raise HTTPException(404, result.get("error"))
    return result


@router.delete("/surveys/{survey_id}")
def delete_survey(survey_id: str):
    """설문 삭제."""
    return _service.delete_survey(survey_id)


# ── 응답 ──────────────────────────────────────────────────────────────────────

@router.post("/surveys/{survey_id}/submit")
def submit_response(survey_id: str, body: dict):
    """설문 응답 제출."""
    answers = body.get("answers", [])
    if not answers:
        raise HTTPException(400, "응답 데이터가 없습니다.")
    try:
        return _service.submit_response(survey_id, answers)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── 내보내기 ──────────────────────────────────────────────────────────────────

@router.get("/surveys/{survey_id}/export")
def export_responses(survey_id: str):
    """답변자별 응답 엑셀 다운로드."""
    path = _service.export_responses(survey_id)
    if not path:
        raise HTTPException(404, "내보낼 데이터가 없습니다.")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"답변자별_응답결과_{survey_id}.xlsx",
    )


@router.get("/surveys/{survey_id}/analysis-export")
def export_analysis(survey_id: str):
    """질문별 분포 엑셀 다운로드."""
    path = _service.export_analysis(survey_id)
    if not path:
        raise HTTPException(404, "분석할 데이터가 없습니다.")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"질문별_응답결과_{survey_id}.xlsx",
    )


# ── AI 분석 ───────────────────────────────────────────────────────────────────

@router.post("/surveys/{survey_id}/run-analysis")
def run_analysis(survey_id: str, force: bool = False):
    """AI 분석 실행 (백그라운드)."""
    result = _service.run_ai_analysis(survey_id, force=force)
    if not result["success"]:
        raise HTTPException(400, result.get("error"))
    return result


@router.get("/surveys/{survey_id}/analysis-status")
def analysis_status(survey_id: str):
    """분석 완료 여부 확인."""
    return _service.get_analysis_status(survey_id)


@router.get("/surveys/{survey_id}/report")
def download_report(survey_id: str):
    """분석 리포트 엑셀 다운로드."""
    path = _service.get_report_path(survey_id)
    if not path:
        raise HTTPException(404, "아직 생성된 분석 리포트가 없습니다.")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"분석리포트_{survey_id}.xlsx",
    )
