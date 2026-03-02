"""Pydantic schemas for Content Manager project."""

from datetime import datetime

from pydantic import BaseModel


class Content(BaseModel):
    id: str
    title: str
    body: str
    category_id: str
    category_name: str
    status: str  # "draft" | "review" | "published" | "archived"
    author: str
    tags: list[str] = []
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ContentCreate(BaseModel):
    title: str
    body: str
    category_id: str
    tags: list[str] = []


class ContentUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    category_id: str | None = None
    tags: list[str] | None = None


class Category(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None
    content_count: int = 0
    created_at: datetime


class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
