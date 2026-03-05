"""Common FastAPI dependencies."""

from typing import AsyncGenerator

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.shared.auth.service import AuthService
from app.shared.auth.schemas import UserInfo
from app.shared.services.n8n_client import N8nClient


# Deprecated: use get_db directly for new code
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


async def get_n8n_client(request: Request) -> N8nClient:
    """Return an N8nClient for account 1 (default).

    For other accounts, use get_webhook_base(n8n_account) directly.
    """
    from app.shared.services.n8n_client import get_webhook_base

    return N8nClient(webhook_base=get_webhook_base(2), timeout=30.0)
