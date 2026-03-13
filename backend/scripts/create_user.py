"""CLI script to create a user account.

Usage:
    docker compose exec backend python -m scripts.create_user \
        --email admin@company.com \
        --name "관리자" \
        --password "securepass123"
"""

import argparse
import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.shared.auth.service import AuthService
from app.shared.models.user import User


async def create_user(email: str, name: str, password: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        # Check for duplicate email
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"오류: 이미 등록된 이메일입니다: {email}")
            await engine.dispose()
            sys.exit(1)

        auth_service = AuthService()
        user = await auth_service.create_user(email, name, password, db)
        print(f"사용자 생성 완료:")
        print(f"  ID:    {user.id}")
        print(f"  이메일: {user.email}")
        print(f"  이름:   {user.name}")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="사용자 계정 생성")
    parser.add_argument("--email", required=True, help="이메일 주소")
    parser.add_argument("--name", required=True, help="사용자 이름")
    parser.add_argument("--password", required=True, help="비밀번호 (최소 8자)")
    args = parser.parse_args()

    if len(args.password) < 8:
        print("오류: 비밀번호는 최소 8자 이상이어야 합니다.")
        sys.exit(1)

    asyncio.run(create_user(args.email, args.name, args.password))


if __name__ == "__main__":
    main()
