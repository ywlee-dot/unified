"""API router for AI Data Openness project."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session

from .service import AIDataOpennessService

router = APIRouter()

_service = AIDataOpennessService()


# ── Providers ─────────────────────────────────────────────────────────────────

@router.get("/providers")
def list_providers():
    """사용 가능한 LLM 프로바이더 목록."""
    return {"providers": _service.list_providers()}


# ── Phase 1 ───────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    """Excel 파일을 업로드하고 파싱 결과를 반환."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Excel 파일(.xlsx, .xls)만 지원합니다.")
    content = await file.read()
    try:
        return await _service.upload(content, file.filename)
    except Exception as e:
        raise HTTPException(400, f"Excel 파싱 실패: {str(e)}")


@router.post("/evaluate")
async def evaluate(
    session_id: str = Form(...),
    institution: str = Form("공공기관"),
    provider_name: str = Form("claude"),
    api_key: str = Form(""),
):
    """파싱된 데이터를 LLM으로 평가."""
    try:
        return await _service.evaluate(session_id, institution, provider_name, api_key)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"평가 실패: {str(e)}")


@router.post("/report")
async def report(
    session_id: str = Form(...),
    representative_idx: int = Form(0),
    provider_name: str = Form("claude"),
    api_key: str = Form(""),
    institution: str = Form("공공기관"),
    db: AsyncSession = Depends(get_db_session),
):
    """평가 결과로 첨부2 보고서를 생성."""
    try:
        return await _service.report(
            session_id,
            representative_idx,
            provider_name,
            api_key,
            institution=institution,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"보고서 생성 실패: {str(e)}")


# ── Phase 1 Demo ──────────────────────────────────────────────────────────────

@router.get("/demo/parsed")
def demo_parsed():
    """데모: 사전 파싱된 Excel 데이터를 반환."""
    return _service.demo_parsed()


@router.get("/demo/evaluation")
def demo_evaluation():
    """데모: 사전 계산된 AI 평가 결과를 반환."""
    return _service.demo_evaluation()


@router.post("/demo/report")
def demo_report():
    """데모: 사전 생성된 첨부2 보고서를 반환."""
    return {"report": _service.demo_report()}


# ── Phase 2 ───────────────────────────────────────────────────────────────────

@router.post("/phase2/upload")
async def phase2_upload(file: UploadFile = File(...)):
    """Phase 2 발굴 목록 Excel 파일을 업로드하고 파싱 결과를 반환."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Excel 파일(.xlsx, .xls)만 지원합니다.")
    content = await file.read()
    try:
        return await _service.phase2_upload(content, file.filename)
    except Exception as e:
        raise HTTPException(400, f"Excel 파싱 실패: {str(e)}")


@router.post("/phase2/generate")
async def phase2_generate(
    session_id: str = Form(...),
    institution: str = Form("공공기관"),
    representative_idx: int = Form(0),
    provider_name: str = Form("claude"),
    api_key: str = Form(""),
    db: AsyncSession = Depends(get_db_session),
):
    """Phase 2 3-에이전트 파이프라인으로 첨부2 보고서를 생성."""
    try:
        return await _service.phase2_generate(
            session_id, institution, representative_idx, provider_name, api_key,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"보고서 생성 실패: {str(e)}")


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


@router.delete("/runs/{execution_id}")
async def delete_run(
    execution_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    deleted = await _service.delete_execution(db, execution_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Execution not found.")
    return {"deleted": True}


# ── Phase 2 Demo ──────────────────────────────────────────────────────────────

@router.get("/phase2/demo/parsed")
def phase2_demo_parsed():
    """Phase 2 데모: 사전 파싱된 발굴 목록 데이터를 반환."""
    return _service.phase2_demo_parsed()


@router.post("/phase2/demo/report")
def phase2_demo_report():
    """Phase 2 데모: 사전 생성된 첨부2 보고서를 반환."""
    return _service.phase2_demo_report()
