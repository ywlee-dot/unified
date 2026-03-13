"""Common FastAPI dependencies."""

from typing import AsyncGenerator

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.shared.auth.service import AuthService
from app.shared.auth.schemas import UserInfo
from app.shared.services.n8n_client import N8nClient

auth_service = AuthService()


# Deprecated: use get_db directly for new code
async def get_db_session(
    db: AsyncSession = Depends(get_db),
) -> AsyncGenerator[AsyncSession, None]:
    """Alias for DB session dependency."""
    yield db


async def get_current_user(request: Request) -> UserInfo:
    """Required auth: reads JWT from cookie, raises 401 if missing/invalid."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    user_info = auth_service.verify_token(token)
    if not user_info:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
    return user_info


async def get_optional_user(request: Request) -> UserInfo | None:
    """Optional auth: returns user info if valid cookie present, None otherwise."""
    token = request.cookies.get("access_token")
    if not token:
        return None
    return auth_service.verify_token(token)


async def get_n8n_client(request: Request) -> N8nClient:
    """Return an N8nClient for account 1 (default).

    For other accounts, use get_webhook_base(n8n_account) directly.
    """
    from app.shared.services.n8n_client import get_webhook_base

    return N8nClient(webhook_base=get_webhook_base(2), timeout=30.0)
