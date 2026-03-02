"""Common FastAPI dependencies."""

from typing import AsyncGenerator

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.shared.auth.service import AuthService
from app.shared.auth.schemas import UserInfo
from app.shared.services.n8n_client import N8nClient
from app.config import settings


async def get_db_session(
    db: AsyncSession = Depends(get_db),
) -> AsyncGenerator[AsyncSession, None]:
    """Alias for DB session dependency."""
    yield db


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> UserInfo | None:
    """Optional auth: returns user info if valid token provided, None otherwise."""
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer "):]
    auth_service = AuthService()
    return auth_service.verify_token(token)


async def get_n8n_client() -> N8nClient:
    """Return a configured N8nClient instance."""
    return N8nClient(
        base_url=settings.N8N_BASE_URL,
        webhook_base=settings.N8N_WEBHOOK_BASE,
        api_key=settings.N8N_API_KEY,
        timeout=30.0,
    )
