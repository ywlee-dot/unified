"""나라장터 입찰공고 API 클라이언트."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService"

BID_TYPE_ENDPOINTS = {
    "goods": "getBidPblancListInfoThng",
    "services": "getBidPblancListInfoServc",
    "construction": "getBidPblancListInfoCnstwk",
}

BID_TYPE_LABELS = {
    "goods": "물품",
    "services": "용역",
    "construction": "공사",
}


def _parse_dt(value: str | None) -> datetime | None:
    """나라장터 날짜 문자열 파싱 (YYYYMMDDHHmm or YYYY-MM-DD HH:mm:ss)."""
    if not value:
        return None
    for fmt in ("%Y%m%d%H%M", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y%m%d%H%M%S"):
        try:
            return datetime.strptime(value.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None


def _safe_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


class G2BClient:
    """나라장터 입찰공고정보서비스 API 클라이언트."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or getattr(settings, "DATA_GO_KR_API_KEY", None)

    async def fetch_notices(
        self,
        bid_type: str,
        start_dt: str,
        end_dt: str,
        keyword: str | None = None,
        page: int = 1,
        num_of_rows: int = 100,
    ) -> tuple[list[dict], int]:
        """입찰공고 목록 조회.

        Args:
            bid_type: "goods", "services", "construction"
            start_dt: 조회 시작일시 YYYYMMDDHHmm
            end_dt: 조회 종료일시 YYYYMMDDHHmm
            keyword: 공고명 키워드 (선택)
            page: 페이지 번호
            num_of_rows: 결과 수 (최대 999)

        Returns:
            (items, total_count)
        """
        if not self.api_key:
            logger.warning("DATA_GO_KR_API_KEY가 설정되지 않았습니다")
            return [], 0

        endpoint_name = BID_TYPE_ENDPOINTS.get(bid_type)
        if not endpoint_name:
            logger.error("지원하지 않는 입찰 유형: %s", bid_type)
            return [], 0

        url = f"{BASE_URL}/{endpoint_name}"
        params = {
            "serviceKey": self.api_key,
            "pageNo": str(page),
            "numOfRows": str(num_of_rows),
            "inqryDiv": "1",
            "inqryBgnDt": start_dt,
            "inqryEndDt": end_dt,
            "type": "json",
        }
        if keyword:
            params["bidNtceNm"] = keyword

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()

            data = resp.json()
            body = data.get("response", {}).get("body", {})
            total_count = int(body.get("totalCount", 0))
            items_raw = body.get("items", [])

            if not items_raw or total_count == 0:
                return [], 0

            # items can be a list or a single dict
            if isinstance(items_raw, dict):
                items_raw = [items_raw]

            items = [self._normalize_item(item, bid_type) for item in items_raw]
            return items, total_count

        except httpx.HTTPStatusError as e:
            logger.error("나라장터 API HTTP 오류: %s %s", e.response.status_code, e.response.text[:200])
            return [], 0
        except Exception:
            logger.exception("나라장터 API 호출 실패 (bid_type=%s)", bid_type)
            return [], 0

    def _normalize_item(self, raw: dict, bid_type: str) -> dict:
        """API 응답 항목을 정규화된 dict로 변환."""
        return {
            "bid_ntce_no": raw.get("bidNtceNo", ""),
            "bid_ntce_ord": raw.get("bidNtceOrd", "00"),
            "bid_ntce_nm": raw.get("bidNtceNm", ""),
            "ntce_instt_nm": raw.get("ntceInsttNm"),
            "dminstt_nm": raw.get("dminsttNm"),
            "bid_ntce_dt": _parse_dt(raw.get("bidNtceDt")),
            "bid_clse_dt": _parse_dt(raw.get("bidClseDt")),
            "openg_dt": _parse_dt(raw.get("opengDt")),
            "presmpt_prce": _safe_float(raw.get("presmptPrce")),
            "asign_bdgt_amt": _safe_float(raw.get("asignBdgtAmt")),
            "cntrct_cncls_mthd_nm": raw.get("cntrctCnclsMthdNm"),
            "bid_type": bid_type,
            "ntce_kind_nm": raw.get("ntceKindNm"),
            "bid_ntce_url": raw.get("bidNtceUrl"),
            "bid_ntce_dtl_url": raw.get("bidNtceDtlUrl"),
            "metadata_json": {
                k: v for k, v in raw.items()
                if k not in {
                    "bidNtceNo", "bidNtceOrd", "bidNtceNm", "ntceInsttNm",
                    "dminsttNm", "bidNtceDt", "bidClseDt", "opengDt",
                    "presmptPrce", "asignBdgtAmt", "cntrctCnclsMthdNm",
                    "ntceKindNm", "bidNtceUrl", "bidNtceDtlUrl",
                }
            },
        }
