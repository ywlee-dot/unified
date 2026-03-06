"""Router for evaluation-rag project."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session

from .schemas import (
    EvaluationCriteriaResponse,
    EvaluationListResponse,
    EvaluationRequest,
    EvaluationResponse,
    EvaluationStatsResponse,
    SimpleEvaluationRequest,
)
from .service import EvaluationRagService

router = APIRouter()
_service = EvaluationRagService()


@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate(
    request: EvaluationRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """RAG 기반 평가 실행."""
    try:
        return await _service.evaluate(
            db=db,
            input_data=request.input_data,
            query=request.query,
            category=request.category,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"평가 중 오류가 발생했습니다: {str(e)}")


@router.post("/evaluate-file", response_model=EvaluationResponse)
async def evaluate_file(
    file: UploadFile = File(...),
    query: str = Form(...),
    category: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    """파일 업로드 기반 RAG 평가 실행."""
    try:
        file_content = await file.read()
        return await _service.evaluate_file(
            db=db,
            file_content=file_content,
            filename=file.filename or "upload",
            query=query,
            category=category,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 평가 중 오류가 발생했습니다: {str(e)}")


@router.post("/evaluate-simple", response_model=EvaluationResponse)
async def evaluate_simple(
    request: SimpleEvaluationRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """RAG 없이 간단 평가 실행 (fallback)."""
    try:
        return await _service.evaluate_simple(
            db=db,
            input_data=request.input_data,
            query=request.query,
            category=request.category,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"평가 중 오류가 발생했습니다: {str(e)}")


@router.get("/evaluations", response_model=EvaluationListResponse)
async def list_evaluations(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
):
    """평가 이력 목록 조회."""
    return await _service.get_evaluations(db=db, page=page, page_size=page_size)


@router.get("/evaluations/{evaluation_id}", response_model=EvaluationResponse)
async def get_evaluation(
    evaluation_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """단일 평가 조회."""
    result = await _service.get_evaluation(db=db, evaluation_id=evaluation_id)
    if not result:
        raise HTTPException(status_code=404, detail="평가를 찾을 수 없습니다")
    return result


@router.get("/stats", response_model=EvaluationStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db_session),
):
    """서비스 통계 조회."""
    return await _service.get_stats(db=db)


@router.get("/criteria", response_model=EvaluationCriteriaResponse)
async def get_criteria(
    category: str | None = None,
):
    """RAG 기반 평가 기준표 조회."""
    return await _service.get_criteria(category=category)
