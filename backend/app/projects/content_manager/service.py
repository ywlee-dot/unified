"""Business logic service for Content Manager project."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.projects.content_manager.dummy_data import get_dummy_categories, get_dummy_contents
from app.projects.content_manager.schemas import (
    Category,
    CategoryCreate,
    Content,
    ContentCreate,
    ContentUpdate,
)


class ContentManagerService:
    """Service returning dummy data for scaffold."""

    async def get_contents(
        self, page: int = 1, page_size: int = 20, status: str | None = None, category_id: str | None = None
    ) -> dict:
        contents = get_dummy_contents()
        if status:
            contents = [c for c in contents if c.status == status]
        if category_id:
            contents = [c for c in contents if c.category_id == category_id]
        total = len(contents)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": contents[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    async def get_content(self, content_id: str) -> Content | None:
        for c in get_dummy_contents():
            if c.id == content_id:
                return c
        return None

    async def create_content(self, data: ContentCreate) -> Content:
        now = datetime.now(timezone.utc)
        cat = await self.get_category(data.category_id)
        return Content(
            id=str(uuid.uuid4()),
            title=data.title,
            body=data.body,
            category_id=data.category_id,
            category_name=cat.name if cat else "미분류",
            status="draft",
            author="admin",
            tags=data.tags,
            published_at=None,
            created_at=now,
            updated_at=now,
        )

    async def update_content(self, content_id: str, data: ContentUpdate) -> Content | None:
        content = await self.get_content(content_id)
        if not content:
            return None
        now = datetime.now(timezone.utc)
        return Content(
            id=content.id,
            title=data.title if data.title is not None else content.title,
            body=data.body if data.body is not None else content.body,
            category_id=data.category_id if data.category_id is not None else content.category_id,
            category_name=content.category_name,
            status=content.status,
            author=content.author,
            tags=data.tags if data.tags is not None else content.tags,
            published_at=content.published_at,
            created_at=content.created_at,
            updated_at=now,
        )

    async def delete_content(self, content_id: str) -> bool:
        content = await self.get_content(content_id)
        return content is not None

    async def publish_content(self, content_id: str) -> Content | None:
        content = await self.get_content(content_id)
        if not content:
            return None
        now = datetime.now(timezone.utc)
        return Content(
            id=content.id, title=content.title, body=content.body,
            category_id=content.category_id, category_name=content.category_name,
            status="published", author=content.author, tags=content.tags,
            published_at=now, created_at=content.created_at, updated_at=now,
        )

    async def unpublish_content(self, content_id: str) -> Content | None:
        content = await self.get_content(content_id)
        if not content:
            return None
        now = datetime.now(timezone.utc)
        return Content(
            id=content.id, title=content.title, body=content.body,
            category_id=content.category_id, category_name=content.category_name,
            status="draft", author=content.author, tags=content.tags,
            published_at=None, created_at=content.created_at, updated_at=now,
        )

    async def get_categories(self) -> list[Category]:
        return get_dummy_categories()

    async def get_category(self, category_id: str) -> Category | None:
        for cat in get_dummy_categories():
            if cat.id == category_id:
                return cat
        return None

    async def create_category(self, data: CategoryCreate) -> Category:
        return Category(
            id=str(uuid.uuid4()),
            name=data.name,
            slug=data.slug,
            description=data.description,
            content_count=0,
            created_at=datetime.now(timezone.utc),
        )

    async def update_category(self, category_id: str, data: CategoryCreate) -> Category | None:
        cat = await self.get_category(category_id)
        if not cat:
            return None
        return Category(
            id=cat.id, name=data.name, slug=data.slug,
            description=data.description, content_count=cat.content_count,
            created_at=cat.created_at,
        )

    async def delete_category(self, category_id: str) -> bool:
        cat = await self.get_category(category_id)
        return cat is not None
