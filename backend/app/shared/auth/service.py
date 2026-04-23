"""Authentication service - DB-backed with bcrypt password hashing."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.shared.auth.schemas import UserInfo
from app.shared.models.user import User

logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )

    async def login(self, email: str, password: str, db: AsyncSession) -> User | None:
        """Authenticate user against DB. Returns User on success, None on failure."""
        result = await db.execute(select(User).where(User.email == email, User.is_active == True))
        user = result.scalar_one_or_none()
        if not user or not user.password_hash:
            return None
        if not self.verify_password(password, user.password_hash):
            logger.warning("Failed login attempt for email=%s", email)
            return None
        # Update last_login_at
        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("Successful login for user_id=%s", user.id)
        return user

    async def create_user(
        self, email: str, name: str, password: str, db: AsyncSession
    ) -> User:
        """Create a new local user with bcrypt-hashed password."""
        user = User(
            email=email,
            name=name,
            password_hash=self.hash_password(password),
            auth_provider="local",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    def create_token(self, user: User) -> str:
        """Create a short-lived access JWT token."""
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        to_encode = {
            "sub": str(user.id),
            "email": user.email,
            "name": user.name,
            "type": "access",
            "exp": expire,
        }
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

    def create_refresh_token(self, user: User) -> str:
        """Create a long-lived refresh JWT token."""
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        to_encode = {
            "sub": str(user.id),
            "type": "refresh",
            "exp": expire,
        }
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

    def verify_token(self, token: str) -> UserInfo | None:
        """Verify access JWT token and return user info."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            if payload.get("type") != "access":
                return None
            return UserInfo(
                user_id=payload["sub"],
                email=payload["email"],
                name=payload["name"],
            )
        except (JWTError, KeyError):
            return None

    def verify_refresh_token(self, token: str) -> str | None:
        """Verify refresh JWT token and return user_id on success."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            if payload.get("type") != "refresh":
                return None
            return payload["sub"]
        except (JWTError, KeyError):
            return None
