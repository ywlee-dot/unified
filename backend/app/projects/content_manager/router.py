"""API router for Content Manager project."""

from fastapi import APIRouter, HTTPException

from app.projects.content_manager.schemas import CategoryCreate, ContentCreate, ContentUpdate
from app.projects.content_manager.service import ContentManagerService

router = APIRouter()

_service = ContentManagerService()


@router.get("/contents")
async def list_contents(
    page: int = 1, page_size: int = 20, status: str | None = None, category_id: str | None = None
):
    return await _service.get_contents(page=page, page_size=page_size, status=status, category_id=category_id)


@router.post("/contents")
async def create_content(data: ContentCreate):
    return await _service.create_content(data)


@router.get("/contents/{content_id}")
async def get_content(content_id: str):
    content = await _service.get_content(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다")
    return content


@router.put("/contents/{content_id}")
async def update_content(content_id: str, data: ContentUpdate):
    content = await _service.update_content(content_id, data)
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다")
    return content


@router.delete("/contents/{content_id}")
async def delete_content(content_id: str):
    deleted = await _service.delete_content(content_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다")
    return {"success": True, "message": "콘텐츠가 삭제되었습니다"}


@router.post("/contents/{content_id}/publish")
async def publish_content(content_id: str):
    content = await _service.publish_content(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다")
    return content


@router.post("/contents/{content_id}/unpublish")
async def unpublish_content(content_id: str):
    content = await _service.unpublish_content(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다")
    return content


@router.get("/categories")
async def list_categories():
    return await _service.get_categories()


@router.post("/categories")
async def create_category(data: CategoryCreate):
    return await _service.create_category(data)


@router.put("/categories/{category_id}")
async def update_category(category_id: str, data: CategoryCreate):
    cat = await _service.update_category(category_id, data)
    if not cat:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다")
    return cat


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    deleted = await _service.delete_category(category_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다")
    return {"success": True, "message": "카테고리가 삭제되었습니다"}
