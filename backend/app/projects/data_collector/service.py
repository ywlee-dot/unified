"""Business logic service for Data Collector project."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.projects.data_collector.dummy_data import (
    get_dummy_history,
    get_dummy_jobs,
    get_dummy_stats,
)
from app.projects.data_collector.schemas import (
    CollectionHistory,
    CollectorJob,
    CollectorJobCreate,
    CollectorStats,
)


class DataCollectorService:
    """Service returning dummy data for scaffold."""

    async def get_jobs(self, page: int = 1, page_size: int = 20) -> dict:
        jobs = get_dummy_jobs()
        total = len(jobs)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": jobs[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    async def get_job(self, job_id: str) -> CollectorJob | None:
        jobs = get_dummy_jobs()
        for job in jobs:
            if job.id == job_id:
                return job
        return None

    async def create_job(self, data: CollectorJobCreate) -> CollectorJob:
        return CollectorJob(
            id=str(uuid.uuid4()),
            name=data.name,
            source_type=data.source_type,
            source_url=data.source_url,
            schedule=data.schedule,
            status="active",
            last_run_at=None,
            collected_count=0,
            created_at=datetime.now(timezone.utc),
        )

    async def update_job(self, job_id: str, data: CollectorJobCreate) -> CollectorJob | None:
        job = await self.get_job(job_id)
        if not job:
            return None
        return CollectorJob(
            id=job.id,
            name=data.name,
            source_type=data.source_type,
            source_url=data.source_url,
            schedule=data.schedule,
            status=job.status,
            last_run_at=job.last_run_at,
            collected_count=job.collected_count,
            created_at=job.created_at,
        )

    async def delete_job(self, job_id: str) -> bool:
        job = await self.get_job(job_id)
        return job is not None

    async def run_job(self, job_id: str) -> dict:
        job = await self.get_job(job_id)
        if not job:
            return {"success": False, "message": "작업을 찾을 수 없습니다"}
        return {
            "success": True,
            "message": f"수집 작업 '{job.name}'이 실행되었습니다",
            "job_id": job_id,
        }

    async def get_job_history(self, job_id: str) -> list[CollectionHistory]:
        return get_dummy_history(job_id)

    async def get_stats(self) -> CollectorStats:
        return get_dummy_stats()
