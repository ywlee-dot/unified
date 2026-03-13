"""
AI 도입활용 사례 정성보고서 작성 Pydantic 스키마
"""
from datetime import datetime
from pydantic import BaseModel


class Ai_case_reportItem(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class Ai_case_reportItemCreate(BaseModel):
    name: str


class Ai_case_reportStats(BaseModel):
    total_items: int
    active_items: int
