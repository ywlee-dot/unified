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

    async def send_order_plan_alert(
        self,
        keyword: str,
        order_plan: dict,
        *,
        match_reasons: list[str] | None = None,
    ) -> bool:
        """발주계획 알림 — 노란색·"📋 발주" prefix, 선행 신호 강조."""
        bid_type_label = BID_TYPE_LABELS.get(order_plan.get("bid_type", ""), "기타")
        match_value = ", ".join(match_reasons) if match_reasons else f"`{keyword}`"

        embed = {
            "title": f"📋 [{bid_type_label}·발주계획] {order_plan.get('prdct_clsfc_no_nm', '제목 없음')}",
            "color": 0xF59E0B,  # amber
            "fields": [
                {"name": "발주계획번호", "value": order_plan.get("order_plan_unty_no") or "-", "inline": True},
                {"name": "발주기관", "value": order_plan.get("ordr_instt_nm") or "-", "inline": True},
                {"name": "발주월", "value": order_plan.get("ordr_yymm") or "-", "inline": True},
                {"name": "배정예산", "value": _format_price(order_plan.get("asign_bdgt_amt")), "inline": True},
                {"name": "공고예정일", "value": _format_dt(order_plan.get("ordr_plan_dt")), "inline": True},
                {"name": "매칭 근거", "value": match_value, "inline": False},
            ],
            "timestamp": datetime.utcnow().isoformat(),
        }
        return await self._post(embed, target_label="발주계획")

    async def send_pre_spec_alert(
        self,
        keyword: str,
        pre_spec: dict,
        *,
        match_reasons: list[str] | None = None,
    ) -> bool:
        """사전규격 알림 — 초록색·"📑 사전규격" prefix, 의견접수 마감 강조."""
        bid_type_label = BID_TYPE_LABELS.get(pre_spec.get("bid_type", ""), "기타")
        match_value = ", ".join(match_reasons) if match_reasons else f"`{keyword}`"

        embed = {
            "title": f"📑 [{bid_type_label}·사전규격] {pre_spec.get('prdct_clsfc_no_nm', '제목 없음')}",
            "color": 0x10B981,  # emerald
            "fields": [
                {"name": "사전규격번호", "value": pre_spec.get("bf_spec_rgst_no") or "-", "inline": True},
                {"name": "공고기관", "value": pre_spec.get("ntce_instt_nm") or "-", "inline": True},
                {"name": "수요기관", "value": pre_spec.get("dminstt_nm") or "-", "inline": True},
                {"name": "배정예산", "value": _format_price(pre_spec.get("asign_bdgt_amt")), "inline": True},
                {"name": "의견접수 마감", "value": _format_dt(pre_spec.get("rcept_clse_dt")), "inline": True},
                {"name": "매칭 근거", "value": match_value, "inline": False},
            ],
            "timestamp": datetime.utcnow().isoformat(),
        }
        return await self._post(embed, target_label="사전규격")

    async def _post(self, embed: dict, *, target_label: str) -> bool:
        payload = {"content": None, "embeds": [embed]}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.webhook_url, json=payload)
                if resp.status_code == 204:
                    return True
                resp.raise_for_status()
                return True
        except Exception:
            logger.exception("Discord %s 알림 전송 실패", target_label)
            return False

    async def send_summary(
        self,
        total_new: int,
        total_alerts: int,
        keywords_checked: int,
        *,
        new_order_plans: int = 0,
        new_pre_specs: int = 0,
    ) -> bool:
        """체크 완료 요약 전송 (새 항목이 하나도 없으면 전송하지 않음)."""
        if total_new == 0 and new_order_plans == 0 and new_pre_specs == 0:
            return True

        lines = [f"**{keywords_checked}개** 키워드 체크 완료"]
        if total_new:
            lines.append(f"📢 신규 입찰공고 **{total_new}건** · 알림 **{total_alerts}건**")
        if new_order_plans:
            lines.append(f"📋 신규 발주계획 **{new_order_plans}건**")
        if new_pre_specs:
            lines.append(f"📑 신규 사전규격 **{new_pre_specs}건**")

        payload = {
            "embeds": [{
                "title": "입찰 모니터링 완료",
                "color": 0x6366F1,
                "description": "\n".join(lines),
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
