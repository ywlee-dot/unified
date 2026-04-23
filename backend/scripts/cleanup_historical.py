"""historical_backfill 데이터 배치 삭제."""
import asyncio, logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
from sqlalchemy import select, func, text
from app.database import async_session_factory
from app.projects.bid_monitor.models import BidNoticeModel


async def batch_delete():
    async with async_session_factory() as db:
        total_deleted = 0
        while True:
            result = await db.execute(text("""
                DELETE FROM bid_notices
                WHERE id IN (
                    SELECT id FROM bid_notices
                    WHERE source_keyword = 'historical_backfill'
                    LIMIT 5000
                )
            """))
            await db.commit()
            deleted = result.rowcount
            total_deleted += deleted
            print(f"batch +{deleted} (total {total_deleted})", flush=True)
            if deleted == 0:
                break
        remaining = (await db.execute(
            select(func.count()).select_from(BidNoticeModel).where(BidNoticeModel.source_keyword == "historical_backfill")
        )).scalar()
        total_notices = (await db.execute(select(func.count()).select_from(BidNoticeModel))).scalar()
        print(f"DONE deleted={total_deleted} remaining_hist={remaining} total_notices={total_notices}", flush=True)


if __name__ == "__main__":
    asyncio.run(batch_delete())
