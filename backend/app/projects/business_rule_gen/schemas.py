"""
업무규칙 자동 생성 Pydantic 스키마
"""
from datetime import datetime
from pydantic import BaseModel


class Business_rule_genItem(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class Business_rule_genItemCreate(BaseModel):
    name: str


class Business_rule_genStats(BaseModel):
    total_items: int
    active_items: int
