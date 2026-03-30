"""filter_engine 단위 테스트."""

import pytest

from app.projects.bid_monitor.core.filter_engine import FilterResult, apply_filters


def _make_item(
    title: str = "테스트 공고",
    bid_type: str = "services",
    presmpt_prce: float | None = 50_000_000,
    asign_bdgt_amt: float | None = None,
    metadata: dict | None = None,
) -> dict:
    """테스트용 공고 아이템 생성."""
    return {
        "bid_ntce_no": "20260330001",
        "bid_ntce_ord": "00",
        "bid_ntce_nm": title,
        "ntce_instt_nm": "테스트기관",
        "dminstt_nm": "수요기관",
        "bid_ntce_dt": None,
        "bid_clse_dt": None,
        "openg_dt": None,
        "presmpt_prce": presmpt_prce,
        "asign_bdgt_amt": asign_bdgt_amt,
        "cntrct_cncls_mthd_nm": "일반경쟁",
        "bid_type": bid_type,
        "ntce_kind_nm": "일반",
        "bid_ntce_url": None,
        "bid_ntce_dtl_url": None,
        "metadata_json": metadata or {},
    }


# -----------------------------------------------------------------------
# 1. title_keywords 매칭/비매칭
# -----------------------------------------------------------------------

class TestTitleKeywords:
    def test_keyword_match(self):
        item = _make_item(title="데이터 분석 시스템 구축")
        fc = {"title_keywords": ["데이터"], "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True
        assert any("title:데이터" in r for r in result.match_reasons)

    def test_keyword_no_match(self):
        item = _make_item(title="엑스선 장비 구매")
        fc = {"title_keywords": ["데이터"], "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False

    def test_keyword_case_insensitive(self):
        item = _make_item(title="AI Data Platform 구축")
        fc = {"title_keywords": ["data"], "match_mode": "any"}
        result = apply_filters(item, "data", fc)
        assert result.passed is True

    def test_multiple_keywords_or(self):
        item = _make_item(title="인공지능 플랫폼 구축")
        fc = {"title_keywords": ["데이터", "인공지능"], "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True
        assert any("title:인공지능" in r for r in result.match_reasons)


# -----------------------------------------------------------------------
# 2. title_exclude 제외
# -----------------------------------------------------------------------

class TestTitleExclude:
    def test_exclude_blocks(self):
        item = _make_item(title="데이터 기반 엑스선 분석")
        fc = {"title_keywords": ["데이터"], "title_exclude": ["엑스선"], "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False

    def test_exclude_no_match_passes(self):
        item = _make_item(title="데이터 분석 시스템")
        fc = {"title_keywords": ["데이터"], "title_exclude": ["엑스선"], "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True

    def test_exclude_overrides_match_mode(self):
        """title_exclude는 match_mode와 무관하게 항상 적용."""
        item = _make_item(title="데이터 엑스선 장비")
        fc = {"title_keywords": ["데이터"], "title_exclude": ["엑스선"], "match_mode": "all"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False


# -----------------------------------------------------------------------
# 3. categories OR 매칭
# -----------------------------------------------------------------------

class TestCategories:
    def test_category_match(self):
        item = _make_item(metadata={"pubPrcrmntLrgClsfcNm": "ICT 서비스"})
        fc = {
            "categories": {"pubPrcrmntLrgClsfcNm": ["ICT 서비스", "연구조사서비스"]},
            "match_mode": "any",
        }
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True
        assert any("category:ICT 서비스" in r for r in result.match_reasons)

    def test_category_no_match(self):
        item = _make_item(metadata={"pubPrcrmntLrgClsfcNm": "기계장비"})
        fc = {
            "categories": {"pubPrcrmntLrgClsfcNm": ["ICT 서비스"]},
            "match_mode": "any",
        }
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False

    def test_category_missing_key(self):
        """metadata에 해당 키가 없으면 미매칭 (에러 아님)."""
        item = _make_item(metadata={})
        fc = {
            "categories": {"pubPrcrmntLrgClsfcNm": ["ICT 서비스"]},
            "match_mode": "any",
        }
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False


# -----------------------------------------------------------------------
# 4. flags 일치/불일치
# -----------------------------------------------------------------------

class TestFlags:
    def test_flag_match(self):
        item = _make_item(metadata={"infoBizYn": "Y"})
        fc = {"flags": {"infoBizYn": "Y"}, "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True
        assert any("flag:infoBizYn=Y" in r for r in result.match_reasons)

    def test_flag_no_match(self):
        item = _make_item(metadata={"infoBizYn": "N"})
        fc = {"flags": {"infoBizYn": "Y"}, "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False

    def test_flag_missing_key(self):
        item = _make_item(metadata={})
        fc = {"flags": {"infoBizYn": "Y"}, "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False


# -----------------------------------------------------------------------
# 5. price_range min/max + None 처리
# -----------------------------------------------------------------------

class TestPriceRange:
    def test_price_in_range(self):
        item = _make_item(presmpt_prce=50_000_000)
        fc = {"price_range": {"min": 10_000_000, "max": None}, "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True
        assert any("price:" in r for r in result.match_reasons)

    def test_price_below_min(self):
        item = _make_item(presmpt_prce=5_000_000)
        fc = {"price_range": {"min": 10_000_000, "max": None}, "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False

    def test_price_above_max(self):
        item = _make_item(presmpt_prce=200_000_000)
        fc = {"price_range": {"min": None, "max": 100_000_000}, "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False

    def test_price_none_passes(self):
        """가격이 None이면 가격 필터 통과."""
        item = _make_item(presmpt_prce=None, asign_bdgt_amt=None)
        fc = {"price_range": {"min": 10_000_000, "max": None}, "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True

    def test_price_fallback_to_budget(self):
        """presmpt_prce가 None이면 asign_bdgt_amt 사용."""
        item = _make_item(presmpt_prce=None, asign_bdgt_amt=80_000_000)
        fc = {"price_range": {"min": 10_000_000, "max": None}, "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True


# -----------------------------------------------------------------------
# 6. match_mode any/all 분기
# -----------------------------------------------------------------------

class TestMatchMode:
    def test_any_mode_one_match_passes(self):
        """any 모드: 하나만 매칭해도 통과."""
        item = _make_item(title="데이터 시스템", metadata={"pubPrcrmntLrgClsfcNm": "기계장비"})
        fc = {
            "title_keywords": ["데이터"],
            "categories": {"pubPrcrmntLrgClsfcNm": ["ICT 서비스"]},
            "match_mode": "any",
        }
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True

    def test_all_mode_partial_fails(self):
        """all 모드: title은 매칭이나 category 미매칭 → 탈락."""
        item = _make_item(title="데이터 시스템", metadata={"pubPrcrmntLrgClsfcNm": "기계장비"})
        fc = {
            "title_keywords": ["데이터"],
            "categories": {"pubPrcrmntLrgClsfcNm": ["ICT 서비스"]},
            "match_mode": "all",
        }
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False

    def test_all_mode_all_match_passes(self):
        """all 모드: 모두 매칭 → 통과."""
        item = _make_item(title="데이터 시스템", metadata={"pubPrcrmntLrgClsfcNm": "ICT 서비스"})
        fc = {
            "title_keywords": ["데이터"],
            "categories": {"pubPrcrmntLrgClsfcNm": ["ICT 서비스"]},
            "match_mode": "all",
        }
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True


# -----------------------------------------------------------------------
# 7. filter_conditions=None 하위호환 (전체 통과)
# -----------------------------------------------------------------------

class TestBackwardCompat:
    def test_none_filter_passes_everything(self):
        """filter_conditions=None → 필터링 없음, 모든 공고 통과."""
        item = _make_item(title="완전히 무관한 엑스선 장비")
        result = apply_filters(item, "데이터", None)
        assert result.passed is True
        assert result.match_reasons == []


# -----------------------------------------------------------------------
# 8. 빈 filter_conditions vacuous truth
# -----------------------------------------------------------------------

class TestVacuousTruth:
    def test_empty_dict_passes(self):
        """빈 filter_conditions → 전체 통과."""
        item = _make_item(title="아무 공고")
        result = apply_filters(item, "데이터", {})
        assert result.passed is True
        assert result.match_reasons == []

    def test_all_empty_lists_passes(self):
        """모든 리스트가 빈 경우 → 전체 통과."""
        fc = {
            "title_keywords": [],
            "title_exclude": [],
            "categories": {},
            "flags": {},
            "match_mode": "any",
        }
        item = _make_item(title="아무 공고")
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True

    def test_only_exclude_with_no_positive(self):
        """title_exclude만 있고 긍정 조건 없으면 exclude 통과 시 전체 통과."""
        fc = {"title_exclude": ["엑스선"], "match_mode": "any"}
        item = _make_item(title="일반 공고")
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True


# -----------------------------------------------------------------------
# 9. match_reasons 검증
# -----------------------------------------------------------------------

class TestMatchReasons:
    def test_multiple_reasons_collected(self):
        """다중 조건 매칭 시 모든 이유 포함."""
        item = _make_item(
            title="빅데이터 분석 플랫폼",
            presmpt_prce=50_000_000,
            metadata={"pubPrcrmntLrgClsfcNm": "ICT 서비스", "infoBizYn": "Y"},
        )
        fc = {
            "title_keywords": ["빅데이터"],
            "categories": {"pubPrcrmntLrgClsfcNm": ["ICT 서비스"]},
            "flags": {"infoBizYn": "Y"},
            "price_range": {"min": 10_000_000, "max": None},
            "match_mode": "any",
        }
        result = apply_filters(item, "데이터", fc)
        assert result.passed is True
        assert len(result.match_reasons) >= 3  # title + category + flag + price

    def test_failed_has_empty_reasons(self):
        """탈락 시 match_reasons는 빈 리스트."""
        item = _make_item(title="엑스선 장비")
        fc = {"title_keywords": ["데이터"], "match_mode": "any"}
        result = apply_filters(item, "데이터", fc)
        assert result.passed is False
        assert result.match_reasons == []
