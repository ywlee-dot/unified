"""Pydantic schemas for Data Collector project."""

from datetime import datetime

from pydantic import BaseModel


class CollectorJob(BaseModel):
    id: str
    name: str
    source_type: str  # "api" | "web" | "rss"
    source_url: str
    schedule: str | None = None  # cron expression
    status: str  # "active" | "paused" | "error"
    last_run_at: datetime | None = None
    collected_count: int = 0
    created_at: datetime


class CollectorJobCreate(BaseModel):
    name: str
    source_type: str
    source_url: str
    schedule: str | None = None


class CollectionHistory(BaseModel):
    id: str
    job_id: str
    started_at: datetime
    finished_at: datetime | None = None
    status: str  # "success" | "failed" | "running"
    items_collected: int = 0
    error_message: str | None = None


class CollectorStats(BaseModel):
    total_jobs: int
    active_jobs: int
    total_collected: int
    last_24h_collected: int
    error_rate: float
