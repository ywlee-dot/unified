"""Authentication router - minimal scaffold."""

from fastapi import APIRouter, HTTPException

from app.shared.auth.schemas import LoginRequest, TokenResponse
from app.shared.auth.service import AuthService

router = APIRouter()
auth_service = AuthService()


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    result = auth_service.login(request.email, request.password)
    if not result:
        raise HTTPException(status_code=401, detail="잘못된 이메일 또는 비밀번호입니다")
    return result


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token():
    """Token refresh - scaffold placeholder."""
    raise HTTPException(status_code=501, detail="Token refresh not implemented in scaffold")
