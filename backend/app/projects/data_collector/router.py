"""API router for Data Collector project."""

from fastapi import APIRouter, HTTPException

from app.projects.data_collector.schemas import CollectorJobCreate
from app.projects.data_collector.service import DataCollectorService

router = APIRouter()

_service = DataCollectorService()


@router.get("/jobs")
async def list_jobs(page: int = 1, page_size: int = 20):
    return await _service.get_jobs(page=page, page_size=page_size)


@router.post("/jobs")
async def create_job(data: CollectorJobCreate):
    return await _service.create_job(data)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await _service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="수집 작업을 찾을 수 없습니다")
    return job


@router.put("/jobs/{job_id}")
async def update_job(job_id: str, data: CollectorJobCreate):
    job = await _service.update_job(job_id, data)
    if not job:
        raise HTTPException(status_code=404, detail="수집 작업을 찾을 수 없습니다")
    return job


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    deleted = await _service.delete_job(job_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="수집 작업을 찾을 수 없습니다")
    return {"success": True, "message": "수집 작업이 삭제되었습니다"}


@router.post("/jobs/{job_id}/run")
async def run_job(job_id: str):
    result = await _service.run_job(job_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@router.get("/jobs/{job_id}/history")
async def get_job_history(job_id: str):
    return await _service.get_job_history(job_id)


@router.get("/stats")
async def get_stats():
    return await _service.get_stats()
