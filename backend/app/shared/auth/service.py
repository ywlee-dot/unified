"""Authentication service - minimal JWT scaffold."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings
from app.shared.auth.schemas import TokenResponse, UserInfo

# Hard-coded test account for scaffold
TEST_USER = {
    "user_id": "test-user-001",
    "email": "admin@test.com",
    "password": "password",
    "name": "관리자",
}


class AuthService:
    def login(self, email: str, password: str) -> TokenResponse | None:
        """Authenticate with hard-coded test account."""
        if email == TEST_USER["email"] and password == TEST_USER["password"]:
            token = self._create_token(
                {"sub": TEST_USER["user_id"], "email": email, "name": TEST_USER["name"]}
            )
            return TokenResponse(access_token=token)
        return None

    def verify_token(self, token: str) -> UserInfo | None:
        """Verify JWT token and return user info."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            return UserInfo(
                user_id=payload["sub"],
                email=payload["email"],
                name=payload["name"],
            )
        except JWTError:
            return None

    def _create_token(self, data: dict) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        to_encode = {**data, "exp": expire}
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
