"""기존 bid_notices의 bid_ntce_dt/bid_clse_dt/openg_dt를 9시간 뒤로 밀린 값에서 교정.

이전 `_parse_dt` 버그로 G2B가 반환한 KST 문자열이 naive datetime으로 파싱되어
TIMESTAMP WITH TIME ZONE 컬럼에 UTC로 오해석되어 저장됨. 실제 KST 시각보다
+9시간 뒤로 기록되어 있어, 기존 행에서 일괄 9시간을 빼는 교정.

실행: docker compose exec backend python -m scripts.fix_bid_date_timezone
"""
import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine


async def main():
    db_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@db:5432/unified")
    engine = create_async_engine(db_url)
    async with AsyncSession(engine) as db:
        r = await db.execute(text(
            "SELECT bid_ntce_no, bid_ntce_dt, bid_clse_dt, openg_dt "
            "FROM bid_notices WHERE bid_ntce_no='R26BK01447541'"
        ))
        row = r.fetchone()
        if row:
            print(f"[교정 전] {row[0]}: dt={row[1]} clse={row[2]} openg={row[3]}")

        await db.execute(text(
            "UPDATE bid_notices SET "
            "  bid_ntce_dt = bid_ntce_dt - INTERVAL '9 hours', "
            "  bid_clse_dt = bid_clse_dt - INTERVAL '9 hours', "
            "  openg_dt    = openg_dt    - INTERVAL '9 hours' "
            "WHERE bid_ntce_dt IS NOT NULL OR bid_clse_dt IS NOT NULL OR openg_dt IS NOT NULL"
        ))
        cnt = (await db.execute(text("SELECT COUNT(*) FROM bid_notices"))).scalar()
        await db.commit()

        r2 = await db.execute(text(
            "SELECT bid_ntce_no, bid_ntce_dt, bid_clse_dt, openg_dt "
            "FROM bid_notices WHERE bid_ntce_no='R26BK01447541'"
        ))
        row2 = r2.fetchone()
        if row2:
            print(f"[교정 후] {row2[0]}: dt={row2[1]} clse={row2[2]} openg={row2[3]}")
        print(f"총 {cnt}건 대상으로 -9h 교정 완료")


if __name__ == "__main__":
    asyncio.run(main())
