"""
민간 활용 우수사례 검색 서비스 Pydantic 스키마
"""
from datetime import datetime
from pydantic import BaseModel


class Best_practice_searchItem(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class Best_practice_searchItemCreate(BaseModel):
    name: str


class Best_practice_searchStats(BaseModel):
    total_items: int
    active_items: int
