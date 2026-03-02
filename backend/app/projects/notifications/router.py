"""API router for Notifications project."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.projects.notifications.schemas import NotificationSend, NotificationTemplateCreate
from app.projects.notifications.service import NotificationService

router = APIRouter()

_service = NotificationService()


class ChannelUpdate(BaseModel):
    is_enabled: bool


@router.get("/templates")
async def list_templates():
    return await _service.get_templates()


@router.post("/templates")
async def create_template(data: NotificationTemplateCreate):
    return await _service.create_template(data)


@router.put("/templates/{template_id}")
async def update_template(template_id: str, data: NotificationTemplateCreate):
    template = await _service.update_template(template_id, data)
    if not template:
        raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다")
    return template


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    deleted = await _service.delete_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다")
    return {"success": True, "message": "템플릿이 삭제되었습니다"}


@router.post("/send")
async def send_notification(data: NotificationSend):
    return await _service.send_notification(data)


@router.get("/history")
async def get_history(page: int = 1, page_size: int = 20):
    return await _service.get_history(page=page, page_size=page_size)


@router.get("/channels")
async def list_channels():
    return await _service.get_channels()


@router.put("/channels/{channel_id}")
async def update_channel(channel_id: str, data: ChannelUpdate):
    channel = await _service.update_channel(channel_id, data.is_enabled)
    if not channel:
        raise HTTPException(status_code=404, detail="채널을 찾을 수 없습니다")
    return channel


@router.get("/stats")
async def get_stats():
    return await _service.get_stats()
