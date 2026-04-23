"""Authentication router - cookie-based JWT."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.shared.auth.schemas import LoginRequest, UserInfo, UserResponse
from app.shared.auth.service import AuthService
from app.shared.models.user import User

router = APIRouter()
auth_service = AuthService()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set httpOnly access + refresh token cookies on response."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        secure=settings.COOKIE_SECURE,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        secure=settings.COOKIE_SECURE,
    )


@router.post("/login", response_model=UserResponse)
async def login(
    request: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.login(request.email, request.password, db)
    if not user:
        raise HTTPException(status_code=401, detail="잘못된 이메일 또는 비밀번호입니다")
    access_token = auth_service.create_token(user)
    refresh_token = auth_service.create_refresh_token(user)
    _set_auth_cookies(response, access_token, refresh_token)
    return UserResponse(
        success=True,
        user=UserInfo(user_id=str(user.id), email=user.email, name=user.name),
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"success": True, "message": "로그아웃 되었습니다"}


@router.get("/me", response_model=UserResponse)
async def get_me(request: Request):
    """Return current user info from cookie."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    user_info = auth_service.verify_token(token)
    if not user_info:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
    return UserResponse(success=True, user=user_info)


@router.post("/refresh", response_model=UserResponse)
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Issue a new access token using a valid refresh token."""
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token이 없습니다")
    user_id = auth_service.verify_refresh_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 Refresh token입니다")
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다")
    new_access_token = auth_service.create_token(user)
    new_refresh_token = auth_service.create_refresh_token(user)
    _set_auth_cookies(response, new_access_token, new_refresh_token)
    return UserResponse(
        success=True,
        user=UserInfo(user_id=str(user.id), email=user.email, name=user.name),
    )
