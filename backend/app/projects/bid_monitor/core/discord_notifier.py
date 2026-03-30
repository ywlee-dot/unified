"""Discord 웹훅 알림 전송."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from app.projects.bid_monitor.core.g2b_client import BID_TYPE_LABELS

logger = logging.getLogger(__name__)


def _format_price(value: float | None) -> str:
    if value is None:
        return "미정"
    if value >= 1_0000_0000:
        return f"{value / 1_0000_0000:,.1f}억원"
    if value >= 1_0000:
        return f"{value / 1_0000:,.0f}만원"
    return f"{value:,.0f}원"


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return "미정"
    return value.strftime("%Y-%m-%d %H:%M")


class DiscordNotifier:
    """Discord 웹훅을 통한 입찰공고 알림."""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send_bid_alert(
        self,
        keyword: str,
        notice: dict,
        *,
        match_reasons: list[str] | None = None,
    ) -> bool:
        """새 입찰공고 알림을 Discord로 전송."""
        bid_type_label = BID_TYPE_LABELS.get(notice.get("bid_type", ""), "기타")
        price = _format_price(notice.get("presmpt_prce") or notice.get("asign_bdgt_amt"))
        detail_url = notice.get("bid_ntce_dtl_url") or notice.get("bid_ntce_url") or ""

        # 매칭 근거 표시: match_reasons가 있으면 상세 표시, 없으면 키워드만
        if match_reasons:
            match_value = ", ".join(match_reasons)
        else:
            match_value = f"`{keyword}`"

        embed = {
            "title": f"[{bid_type_label}] {notice.get('bid_ntce_nm', '제목 없음')}",
            "color": 0x6366F1,
            "fields": [
                {"name": "공고번호", "value": notice.get("bid_ntce_no", "-"), "inline": True},
                {"name": "공고기관", "value": notice.get("ntce_instt_nm") or "-", "inline": True},
                {"name": "수요기관", "value": notice.get("dminstt_nm") or "-", "inline": True},
                {"name": "추정가격", "value": price, "inline": True},
                {"name": "입찰마감", "value": _format_dt(notice.get("bid_clse_dt")), "inline": True},
                {"name": "계약방법", "value": notice.get("cntrct_cncls_mthd_nm") or "-", "inline": True},
                {"name": "매칭 근거", "value": match_value, "inline": False},
            ],
            "timestamp": datetime.utcnow().isoformat(),
        }
        if detail_url:
            embed["url"] = detail_url

        payload = {
            "content": None,
            "embeds": [embed],
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.webhook_url, json=payload)
                if resp.status_code == 204:
                    return True
                resp.raise_for_status()
                return True
        except Exception:
            logger.exception("Discord 알림 전송 실패 (공고: %s)", notice.get("bid_ntce_no"))
            return False

    async def send_summary(self, total_new: int, total_alerts: int, keywords_checked: int) -> bool:
        """체크 완료 요약 전송 (새 공고가 없을 때는 전송하지 않음)."""
        if total_new == 0:
            return True

        payload = {
            "embeds": [{
                "title": "입찰공고 모니터링 완료",
                "color": 0x10B981,
                "description": (
                    f"**{keywords_checked}개** 키워드 체크 완료\n"
                    f"새 공고 **{total_new}건** 발견, 알림 **{total_alerts}건** 전송"
                ),
                "timestamp": datetime.utcnow().isoformat(),
            }],
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.webhook_url, json=payload)
                return resp.status_code in (200, 204)
        except Exception:
            logger.exception("Discord 요약 전송 실패")
            return False
