"""Authentication router - cookie-based JWT."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.shared.auth.schemas import LoginRequest, UserInfo, UserResponse
from app.shared.auth.service import AuthService

router = APIRouter()
auth_service = AuthService()


def _set_auth_cookie(response: Response, token: str) -> None:
    """Set httpOnly JWT cookie on response."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        secure=settings.COOKIE_SECURE or not settings.DEBUG,
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
    token = auth_service.create_token(user)
    _set_auth_cookie(response, token)
    return UserResponse(
        success=True,
        user=UserInfo(user_id=user.id, email=user.email, name=user.name),
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
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


@router.post("/refresh")
async def refresh_token():
    """Token refresh - not implemented in Phase 1."""
    raise HTTPException(status_code=501, detail="Token refresh not implemented yet")
