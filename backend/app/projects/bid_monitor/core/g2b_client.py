"""나라장터 입찰공고 API 클라이언트."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from app.config import settings
from datetime import timezone, timedelta

logger = logging.getLogger(__name__)

BASE_URL = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService"

# 신규 서비스 base URL — `/ao/` prefix
BASE_URL_ORDER_PLAN = "https://apis.data.go.kr/1230000/ao/OrderPlanSttusService"
BASE_URL_PRE_SPEC = "https://apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService"
BASE_URL_PIPELINE = "https://apis.data.go.kr/1230000/ao/CntrctProcssIntgOpenService"

# G2B API는 KST 기준 naive 시간 문자열을 반환한다.
KST = timezone(timedelta(hours=9))

BID_TYPE_ENDPOINTS = {
    "goods": "getBidPblancListInfoThng",
    "services": "getBidPblancListInfoServc",
    "construction": "getBidPblancListInfoCnstwk",
    "frgcpt": "getBidPblancListInfoFrgcpt",
}

BID_TYPE_SEARCH_ENDPOINTS = {
    "goods": "getBidPblancListInfoThngPPSSrch",
    "services": "getBidPblancListInfoServcPPSSrch",
    "construction": "getBidPblancListInfoCnstwkPPSSrch",
}

# 발주계획 — 4업종별
ORDER_PLAN_ENDPOINTS = {
    "goods": "getOrderPlanSttusListThng",
    "services": "getOrderPlanSttusListServc",
    "construction": "getOrderPlanSttusListCnstwk",
    "frgcpt": "getOrderPlanSttusListFrgcpt",
}

# 사전규격 — 4업종별
PRE_SPEC_ENDPOINTS = {
    "goods": "getPublicPrcureThngInfoThng",
    "services": "getPublicPrcureThngInfoServc",
    "construction": "getPublicPrcureThngInfoCnstwk",
    "frgcpt": "getPublicPrcureThngInfoFrgcpt",
}

# 계약과정통합공개 — 4업종별
PIPELINE_ENDPOINTS = {
    "goods": "getCntrctProcssIntgOpenThng",
    "services": "getCntrctProcssIntgOpenServc",
    "construction": "getCntrctProcssIntgOpenCnstwk",
    "frgcpt": "getCntrctProcssIntgOpenFrgcpt",
}

BID_TYPE_LABELS = {
    "goods": "물품",
    "services": "용역",
    "construction": "공사",
    "frgcpt": "외자",
}


def _parse_dt(value: str | None) -> datetime | None:
    """나라장터 날짜 문자열 파싱 (YYYYMMDDHHmm or YYYY-MM-DD HH:mm:ss).
    G2B 응답은 KST naive 문자열이므로 KST tzinfo를 부착해서 반환한다.
    """
    if not value:
        return None
    for fmt in ("%Y%m%d%H%M", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y%m%d%H%M%S"):
        try:
            naive = datetime.strptime(value.strip(), fmt)
            return naive.replace(tzinfo=KST)
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

    async def fetch_by_institution(
        self,
        bid_type: str,
        start_dt: str,
        end_dt: str,
        dminstt_cd: str | None = None,
        ntce_instt_cd: str | None = None,
        page: int = 1,
        num_of_rows: int = 100,
    ) -> tuple[list[dict], int]:
        """PPSSrch 엔드포인트로 기관코드 필터 조회 (서버 필터 작동).

        조회 범위 최대 31일 제한. 기관 필터는 dminsttCd(수요기관) 또는 ntceInsttCd(공고기관).
        """
        if not self.api_key:
            return [], 0

        endpoint = BID_TYPE_SEARCH_ENDPOINTS.get(bid_type)
        if not endpoint:
            return [], 0

        url = f"{BASE_URL}/{endpoint}"
        params = {
            "serviceKey": self.api_key,
            "pageNo": str(page),
            "numOfRows": str(num_of_rows),
            "inqryDiv": "1",
            "inqryBgnDt": start_dt,
            "inqryEndDt": end_dt,
            "type": "json",
        }
        if dminstt_cd:
            params["dminsttCd"] = dminstt_cd
        if ntce_instt_cd:
            params["ntceInsttCd"] = ntce_instt_cd

        import asyncio as _aio
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(url, params=params)
                if resp.status_code == 429:
                    wait = 15 * (attempt + 1)
                    logger.warning("PPSSrch 429 (attempt %d) — %ds 대기", attempt + 1, wait)
                    await _aio.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()
                body = data.get("response", {}).get("body", {})
                total_raw = body.get("totalCount", 0)
                total = int(total_raw) if isinstance(total_raw, (int, str)) and str(total_raw).isdigit() else 0
                items_raw = body.get("items", [])
                if not items_raw:
                    return [], total
                if isinstance(items_raw, dict):
                    items_raw = [items_raw]
                items = [self._normalize_item(item, bid_type) for item in items_raw]
                return items, total
            except httpx.HTTPStatusError:
                logger.exception("PPSSrch API 호출 실패 (bid_type=%s, dminsttCd=%s)", bid_type, dminstt_cd)
                return [], 0
            except Exception:
                logger.exception("PPSSrch API 호출 실패 (bid_type=%s, dminsttCd=%s)", bid_type, dminstt_cd)
                return [], 0
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

    # -----------------------------------------------------------------------
    # 발주계획 (OrderPlanSttusService)
    # -----------------------------------------------------------------------

    async def fetch_order_plans(
        self,
        bid_type: str,
        start_dt: str,
        end_dt: str,
        page: int = 1,
        num_of_rows: int = 100,
    ) -> tuple[list[dict], int]:
        """발주계획 목록 조회.

        활용가이드: 검색조건(inqryDiv) — 1=등록일시, 2=변경일시, 3=발주년월.
        실제로는 inqryDiv=3 + orderBgnYm/orderEndYm(YYYYMM) 조합이 필수에 가깝게 동작.
        등록일시 윈도우(start_dt/end_dt)는 발주월 범위로 변환해 함께 보낸다.

        Args:
            bid_type: "goods" | "services" | "construction" | "frgcpt"
            start_dt/end_dt: YYYYMMDDHHmm
        """
        if not self.api_key:
            return [], 0
        endpoint = ORDER_PLAN_ENDPOINTS.get(bid_type)
        if not endpoint:
            return [], 0
        # 등록일시 → 발주월 범위 추출 (해당 월 + 다음 1년 커버)
        try:
            from datetime import datetime as _dt, timedelta as _td
            d_start = _dt.strptime(start_dt[:8], "%Y%m%d")
            d_end = _dt.strptime(end_dt[:8], "%Y%m%d")
            order_bgn_ym = d_start.strftime("%Y%m")
            # 발주는 등록보다 미래로 잡혀있을 수 있어 향후 12개월까지 커버
            order_end_ym = (d_end + _td(days=365)).strftime("%Y%m")
        except Exception:
            order_bgn_ym = start_dt[:6]
            order_end_ym = end_dt[:6]

        url = f"{BASE_URL_ORDER_PLAN}/{endpoint}"
        params = {
            "serviceKey": self.api_key,
            "pageNo": str(page),
            "numOfRows": str(num_of_rows),
            "inqryDiv": "1",  # 1=등록일자
            "inqryBgnDt": start_dt,
            "inqryEndDt": end_dt,
            "orderBgnYm": order_bgn_ym,
            "orderEndYm": order_end_ym,
            "type": "json",
        }
        return await self._fetch_list(url, params, _normalize_order_plan, bid_type)

    # -----------------------------------------------------------------------
    # 사전규격 (HrcspSsstndrdInfoService)
    # -----------------------------------------------------------------------

    async def fetch_pre_specs(
        self,
        bid_type: str,
        start_dt: str,
        end_dt: str,
        page: int = 1,
        num_of_rows: int = 100,
    ) -> tuple[list[dict], int]:
        """사전규격 목록 조회.

        Args:
            bid_type: "goods" | "services" | "construction" | "frgcpt"
            start_dt: YYYYMMDDHHmm (선택)
            end_dt: YYYYMMDDHHmm (필수)
        """
        if not self.api_key:
            return [], 0
        endpoint = PRE_SPEC_ENDPOINTS.get(bid_type)
        if not endpoint:
            return [], 0
        url = f"{BASE_URL_PRE_SPEC}/{endpoint}"
        params = {
            "serviceKey": self.api_key,
            "pageNo": str(page),
            "numOfRows": str(num_of_rows),
            "inqryDiv": "1",
            "inqryBgnDt": start_dt,
            "inqryEndDt": end_dt,
            "type": "json",
        }
        return await self._fetch_list(url, params, _normalize_pre_spec, bid_type)

    # -----------------------------------------------------------------------
    # 계약과정통합공개 (CntrctProcssIntgOpenService) — 연결 API
    # -----------------------------------------------------------------------

    async def fetch_pipeline(
        self,
        bid_type: str,
        *,
        bid_ntce_no: str | None = None,
        bid_ntce_ord: str | None = None,
        bf_spec_rgst_no: str | None = None,
        order_plan_no: str | None = None,
        prcrmnt_req_no: str | None = None,
    ) -> dict | None:
        """4단계(발주/사전/공고/낙찰·계약) 진행 정보 조회.

        bidNtceNo+bidNtceOrd / bfSpecRgstNo / orderPlanNo / prcrmntReqNo 중 1개로 lookup.
        """
        if not self.api_key:
            return None
        endpoint = PIPELINE_ENDPOINTS.get(bid_type)
        if not endpoint:
            return None
        url = f"{BASE_URL_PIPELINE}/{endpoint}"
        params: dict = {
            "serviceKey": self.api_key,
            "pageNo": "1",
            "numOfRows": "10",
            "inqryDiv": "1",
            "type": "json",
        }
        if bid_ntce_no:
            params["bidNtceNo"] = bid_ntce_no
            if bid_ntce_ord:
                params["bidNtceOrd"] = bid_ntce_ord
        elif bf_spec_rgst_no:
            params["bfSpecRgstNo"] = bf_spec_rgst_no
        elif order_plan_no:
            params["orderPlanNo"] = order_plan_no
        elif prcrmnt_req_no:
            params["prcrmntReqNo"] = prcrmnt_req_no
        else:
            return None

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
            data = resp.json()
            body = data.get("response", {}).get("body", {})
            items_raw = body.get("items", [])
            if not items_raw:
                return None
            if isinstance(items_raw, dict):
                items_raw = [items_raw]
            return _normalize_pipeline(items_raw[0], bid_type) if items_raw else None
        except httpx.HTTPStatusError as e:
            logger.error(
                "계약과정통합공개 API HTTP 오류: %s %s",
                e.response.status_code, e.response.text[:200],
            )
            return None
        except Exception:
            logger.exception("계약과정통합공개 API 호출 실패 (bid_type=%s)", bid_type)
            return None

    # -----------------------------------------------------------------------
    # Internal: list-fetch w/ retry (429 backoff)
    # -----------------------------------------------------------------------

    async def _fetch_list(
        self,
        url: str,
        params: dict,
        normalizer,
        bid_type: str,
    ) -> tuple[list[dict], int]:
        import asyncio as _aio
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(url, params=params)
                if resp.status_code == 429:
                    wait = 15 * (attempt + 1)
                    logger.warning(
                        "%s 429 (attempt %d) — %ds 대기", url.rsplit("/", 1)[-1], attempt + 1, wait,
                    )
                    await _aio.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()
                body = data.get("response", {}).get("body", {})
                total_raw = body.get("totalCount", 0)
                total = int(total_raw) if isinstance(total_raw, (int, str)) and str(total_raw).isdigit() else 0
                items_raw = body.get("items", [])
                if not items_raw:
                    return [], total
                if isinstance(items_raw, dict):
                    items_raw = [items_raw]
                items = [normalizer(item, bid_type) for item in items_raw]
                return items, total
            except httpx.HTTPStatusError as e:
                logger.error(
                    "%s HTTP 오류: %s %s",
                    url.rsplit("/", 1)[-1], e.response.status_code, e.response.text[:200],
                )
                return [], 0
            except Exception:
                logger.exception("%s API 호출 실패 (bid_type=%s)", url.rsplit("/", 1)[-1], bid_type)
                return [], 0
        return [], 0


# ---------------------------------------------------------------------------
# Module-level normalizers (자유 함수 — class scope 밖이라 _fetch_list에서 참조)
# ---------------------------------------------------------------------------

_ORDER_PLAN_KEYS = {
    "orderPlanUntyNo", "prdctClsfcNoNm", "bizNm",
    "sumOrderAmt", "asignBdgtAmt", "orderContrctAmt",
    "nticeDt", "orderYear", "orderMnth",
    "orderInsttCd", "orderInsttNm",
    # 추정/혹은 다른 표기들도 함께 제외
    "ordrPlanDt", "ordrYymm", "ordrInsttCd", "ordrInsttNm",
}


def _normalize_order_plan(raw: dict, bid_type: str) -> dict:
    """발주계획 응답 → 내부 dict.

    실측 키: orderPlanUntyNo(번호), bizNm(사업명), sumOrderAmt(발주합계금액),
    orderInsttNm(발주기관), orderYear+orderMnth(발주연월), nticeDt(공고예정일시).
    """
    # 발주월: orderYear+orderMnth 조합 (둘 다 있을 때) → "YYYYMM"
    yymm = None
    yr = (raw.get("orderYear") or "").strip()
    mn = (raw.get("orderMnth") or "").strip()
    if yr and mn:
        yymm = f"{yr}{mn.zfill(2)}"
    elif raw.get("ordrYymm"):
        yymm = raw["ordrYymm"]

    return {
        "order_plan_unty_no": raw.get("orderPlanUntyNo") or raw.get("orderPlanNo") or "",
        "bid_type": bid_type,
        "prdct_clsfc_no_nm": (
            raw.get("bizNm")  # 사업명 (실측: 가장 신뢰할 수 있는 제목)
            or raw.get("prdctClsfcNoNm")
            or raw.get("ordrPlanNm")
            or raw.get("ordrPlanNoNm")
        ),
        "asign_bdgt_amt": _safe_float(
            raw.get("sumOrderAmt")  # 실측: 발주합계금액 (실제 예산)
            or raw.get("asignBdgtAmt")
            or raw.get("orderContrctAmt")
            or raw.get("plnPrce")
        ),
        "ordr_plan_dt": _parse_dt(
            raw.get("nticeDt")  # 실측: 공고예정일시
            or raw.get("ordrPlanDt")
            or raw.get("ntcePrearngDt")
        ),
        "ordr_yymm": yymm,
        "ordr_instt_cd": raw.get("orderInsttCd") or raw.get("ordrInsttCd") or raw.get("dminsttCd"),
        "ordr_instt_nm": raw.get("orderInsttNm") or raw.get("ordrInsttNm") or raw.get("dminsttNm"),
        "metadata_json": {k: v for k, v in raw.items() if k not in _ORDER_PLAN_KEYS},
    }


_PRE_SPEC_KEYS = {
    "bfSpecRgstNo", "prdctClsfcNoNm", "asignBdgtAmt",
    "rceptBgnDt", "rceptClseDt", "rgstDt",
    "ntceInsttCd", "ntceInsttNm", "dminsttCd", "dminsttNm",
}


def _normalize_pre_spec(raw: dict, bid_type: str) -> dict:
    """사전규격 응답 → 내부 dict.

    실측 응답 필드: prdctClsfcNoNm(사업명), opninRgstClseDt(의견등록마감),
    rcptDt(접수일자), orderInsttNm(공고기관), rlDminsttNm(실수요기관),
    bidNtceNoList(연관 공고번호 — pipeline link 자동 충전 가능).
    """
    return {
        "bf_spec_rgst_no": raw.get("bfSpecRgstNo") or "",
        "bid_type": bid_type,
        "prdct_clsfc_no_nm": (
            raw.get("prdctClsfcNoNm")
            or raw.get("bizNm")
            or raw.get("specRgstNm")
        ),
        "asign_bdgt_amt": _safe_float(raw.get("asignBdgtAmt")),
        "rcept_bgn_dt": _parse_dt(raw.get("rceptBgnDt") or raw.get("rcptDt")),
        "rcept_clse_dt": _parse_dt(
            raw.get("rceptClseDt") or raw.get("opninRgstClseDt")
        ),
        "rgst_dt": _parse_dt(raw.get("rgstDt") or raw.get("rcptDt")),
        "ntce_instt_cd": raw.get("ntceInsttCd"),
        "ntce_instt_nm": raw.get("ntceInsttNm") or raw.get("orderInsttNm"),
        "dminstt_cd": raw.get("dminsttCd"),
        "dminstt_nm": raw.get("dminsttNm") or raw.get("rlDminsttNm"),
        "metadata_json": {k: v for k, v in raw.items() if k not in _PRE_SPEC_KEYS},
    }


def _normalize_pipeline(raw: dict, bid_type: str) -> dict:
    """계약과정통합공개 응답 → 단계별 식별자 묶음 dict."""
    return {
        "bid_type": bid_type,
        "prcrmnt_req_no": raw.get("prcrmntReqNo"),
        "order_plan_unty_no": raw.get("orderPlanUntyNo") or raw.get("orderPlanNo"),
        "bf_spec_rgst_no": raw.get("bfSpecRgstNo"),
        "bid_ntce_no": raw.get("bidNtceNo"),
        "bid_ntce_ord": raw.get("bidNtceOrd"),
        "cntrct_no": raw.get("cntrctNo"),
        "raw_response": raw,
    }
