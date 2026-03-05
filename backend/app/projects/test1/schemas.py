"""
테스트1 Pydantic 스키마
"""
from datetime import datetime
from pydantic import BaseModel


class Test1Item(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class Test1ItemCreate(BaseModel):
    name: str


class Test1Stats(BaseModel):
    total_items: int
    active_items: int
