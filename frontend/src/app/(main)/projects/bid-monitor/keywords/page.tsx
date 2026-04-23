"use client";

import { useState, useEffect, useRef } from "react";
import { BidKeyword, FilterConditions } from "@/lib/types";
import { formatKst } from "@/lib/datetime";

const API_BASE = "/api";

const BID_TYPE_OPTIONS = [
  { value: "goods", label: "물품", color: "#3B82F6", bg: "bg-blue-50", text: "text-blue-600" },
  { value: "services", label: "용역", color: "#8B5CF6", bg: "bg-purple-50", text: "text-purple-600" },
  { value: "construction", label: "공사", color: "#F59E0B", bg: "bg-amber-50", text: "text-amber-600" },
];

const LRG_CLSFC_SUGGESTIONS = [
  "ICT 서비스", "연구조사서비스", "기술용역", "교육 및 전문직종/기술서비스",
  "매체제작", "디자인", "홍보/마케팅 서비스", "시설물관리 및 청소서비스",
  "여행*숙박*음식*운송 및 보험서비스", "임대*위탁 및 수리서비스",
  "폐기물 처리 및 재활용서비스", "행사관리 및 기타 사업 지원서비스",
];
const CLSFC_SUGGESTIONS = [
  "데이터서비스", "정보시스템개발서비스", "소프트웨어개발서비스", "정보보안서비스",
  "클라우드서비스", "정보화전략계획서비스", "정보시스템유지관리서비스",
  "정보인프라구축서비스", "정보시스템감리서비스",
];
const MID_CLSFC_SUGGESTIONS = ["DB구축 및 자료입력", "학술연구서비스"];
const PRODUCT_CLSFC_SUGGESTIONS = ["교육용소프트웨어", "그래픽소프트웨어", "AI서버"];
const BID_METHOD_SUGGESTIONS = ["전자입찰", "전자시담", "전자시담(2인 이상)", "직찰", "직찰/우편"];
const SUCCESS_BID_SUGGESTIONS = ["협상에의한계약", "수의시담", "규격가격동시입찰", "최저가낙찰제", "소액수의견적"];
const REGION_SUGGESTIONS = [
  "서울특별시", "경기도", "부산광역시", "대전광역시",
  "세종특별자치시", "대구광역시", "인천광역시", "광주광역시",
];
const RGST_TYPE_SUGGESTIONS = ["조달청 또는 나라장터 자체 공고건"];

function BidTypeTag({ type }: { type: string }) {
  const opt = BID_TYPE_OPTIONS.find((o) => o.value === type);
  if (!opt) return <span className="rounded-sm bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">{type}</span>;
  return (
    <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${opt.bg} ${opt.text}`}>
      {opt.label}
    </span>
  );
}

// Tag input component used in the filter modal
function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  suggestions,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const trimmed = inputVal.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setInputVal("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inputVal.trim()}
          className="h-9 rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-40"
        >
          추가
        </button>
      </div>

      {/* Suggestion chips */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { if (!tags.includes(s)) onAdd(s); }}
              disabled={tags.includes(s)}
              className={`rounded-sm px-2 py-0.5 text-xs font-medium transition-colors ${
                tags.includes(s)
                  ? "bg-brand/10 text-brand cursor-default"
                  : "bg-surface-secondary text-text-secondary hover:bg-brand/10 hover:text-brand"
              }`}
            >
              {tags.includes(s) ? "✓ " : "+ "}{s}
            </button>
          ))}
        </div>
      )}

      {/* Tag list */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-sm bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-brand/60 transition-colors hover:bg-brand/20 hover:text-brand"
                aria-label={`${tag} 제거`}
              >
                <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5">
                  <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06l-2.72 2.72a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Filter state shape used by the modal form ----
interface FilterFormState {
  title_keywords: string[];
  title_exclude: string[];
  search_aliases: string[];
  institutions: string[];
  lrg_clsfc: string[];
  clsfc: string[];
  mid_clsfc: string[];
  product_clsfc: string[];
  success_bid_method: string[];
  bid_method: string[];
  region: string[];
  rgst_type: string[];
  info_biz_yn: "전체" | "Y" | "N";
  re_ntce_yn: "전체" | "Y" | "N";
  indstryty_lmt_yn: "전체" | "Y" | "N";
  prdct_clsfc_lmt_yn: "전체" | "Y" | "N";
  dsgnt_cmpt_yn: "전체" | "Y" | "N";
  arslt_cmpt_yn: "전체" | "Y" | "N";
  ppsw_gnrl_srvce_yn: "전체" | "Y" | "N";
  price_min: string;
  price_max: string;
  match_mode: "any" | "all";
  // Scoring
  w_title_keyword: string;
  w_title_alias: string;
  w_category_exact: string;
  w_category_mid: string;
  w_category_large: string;
  w_institution: string;
  w_flag: string;
  w_price_in: string;
  w_price_out: string;
  th_high: string;
  th_medium: string;
  th_low: string;
}

const defaultFilterForm: FilterFormState = {
  title_keywords: [],
  title_exclude: [],
  search_aliases: [],
  institutions: [],
  lrg_clsfc: [],
  clsfc: [],
  mid_clsfc: [],
  product_clsfc: [],
  success_bid_method: [],
  bid_method: [],
  region: [],
  rgst_type: [],
  info_biz_yn: "전체",
  re_ntce_yn: "전체",
  indstryty_lmt_yn: "전체",
  prdct_clsfc_lmt_yn: "전체",
  dsgnt_cmpt_yn: "전체",
  arslt_cmpt_yn: "전체",
  ppsw_gnrl_srvce_yn: "전체",
  price_min: "",
  price_max: "",
  match_mode: "any",
  w_title_keyword: "30",
  w_title_alias: "15",
  w_category_exact: "25",
  w_category_mid: "15",
  w_category_large: "10",
  w_institution: "10",
  w_flag: "10",
  w_price_in: "5",
  w_price_out: "-10",
  th_high: "80",
  th_medium: "50",
  th_low: "30",
};

function filterConditionsToForm(fc: FilterConditions | null | undefined): FilterFormState {
  if (!fc) return defaultFilterForm;
  const w = fc.scoring_weights ?? {};
  const th = fc.scoring_thresholds ?? {};
  const numStr = (v: number | undefined, d: string) => (v != null ? String(v) : d);
  return {
    title_keywords: fc.title_keywords ?? [],
    title_exclude: fc.title_exclude ?? [],
    search_aliases: fc.search_aliases ?? [],
    institutions: fc.institutions ?? [],
    lrg_clsfc: fc.categories?.pubPrcrmntLrgClsfcNm ?? [],
    clsfc: fc.categories?.pubPrcrmntClsfcNm ?? [],
    mid_clsfc: fc.categories?.pubPrcrmntMidClsfcNm ?? [],
    product_clsfc: fc.categories?.dtilPrdctClsfcNoNm ?? [],
    success_bid_method: fc.categories?.sucsfbidMthdNm ?? [],
    bid_method: fc.categories?.bidMethdNm ?? [],
    region: fc.categories?.cnstrtsiteRgnNm ?? [],
    rgst_type: fc.categories?.rgstTyNm ?? [],
    info_biz_yn: (fc.flags?.infoBizYn as "전체" | "Y" | "N") ?? "전체",
    re_ntce_yn: (fc.flags?.reNtceYn as "전체" | "Y" | "N") ?? "전체",
    indstryty_lmt_yn: (fc.flags?.indstrytyLmtYn as "전체" | "Y" | "N") ?? "전체",
    prdct_clsfc_lmt_yn: (fc.flags?.prdctClsfcLmtYn as "전체" | "Y" | "N") ?? "전체",
    dsgnt_cmpt_yn: (fc.flags?.dsgntCmptYn as "전체" | "Y" | "N") ?? "전체",
    arslt_cmpt_yn: (fc.flags?.arsltCmptYn as "전체" | "Y" | "N") ?? "전체",
    ppsw_gnrl_srvce_yn: (fc.flags?.ppswGnrlSrvceYn as "전체" | "Y" | "N") ?? "전체",
    price_min: fc.price_range?.min != null ? String(fc.price_range.min) : "",
    price_max: fc.price_range?.max != null ? String(fc.price_range.max) : "",
    match_mode: fc.match_mode ?? "any",
    w_title_keyword: numStr(w.title_keyword, "30"),
    w_title_alias: numStr(w.title_alias, "15"),
    w_category_exact: numStr(w.category_exact, "25"),
    w_category_mid: numStr(w.category_mid, "15"),
    w_category_large: numStr(w.category_large, "10"),
    w_institution: numStr(w.institution, "10"),
    w_flag: numStr(w.flag, "10"),
    w_price_in: numStr(w.price_in_range, "5"),
    w_price_out: numStr(w.price_out_range, "-10"),
    th_high: numStr(th.high, "80"),
    th_medium: numStr(th.medium, "50"),
    th_low: numStr(th.low, "30"),
  };
}

function formToFilterConditions(form: FilterFormState): FilterConditions {
  const minVal = form.price_min.replace(/,/g, "");
  const maxVal = form.price_max.replace(/,/g, "");

  const flags: Record<string, string> = {};
  if (form.info_biz_yn !== "전체") flags.infoBizYn = form.info_biz_yn;
  if (form.re_ntce_yn !== "전체") flags.reNtceYn = form.re_ntce_yn;
  if (form.indstryty_lmt_yn !== "전체") flags.indstrytyLmtYn = form.indstryty_lmt_yn;
  if (form.prdct_clsfc_lmt_yn !== "전체") flags.prdctClsfcLmtYn = form.prdct_clsfc_lmt_yn;
  if (form.dsgnt_cmpt_yn !== "전체") flags.dsgntCmptYn = form.dsgnt_cmpt_yn;
  if (form.arslt_cmpt_yn !== "전체") flags.arsltCmptYn = form.arslt_cmpt_yn;
  if (form.ppsw_gnrl_srvce_yn !== "전체") flags.ppswGnrlSrvceYn = form.ppsw_gnrl_srvce_yn;

  const num = (s: string, d: number) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : d;
  };

  return {
    title_keywords: form.title_keywords,
    title_exclude: form.title_exclude,
    search_aliases: form.search_aliases,
    institutions: form.institutions,
    categories: {
      pubPrcrmntLrgClsfcNm: form.lrg_clsfc,
      pubPrcrmntClsfcNm: form.clsfc,
      pubPrcrmntMidClsfcNm: form.mid_clsfc,
      dtilPrdctClsfcNoNm: form.product_clsfc,
      sucsfbidMthdNm: form.success_bid_method,
      bidMethdNm: form.bid_method,
      cnstrtsiteRgnNm: form.region,
      rgstTyNm: form.rgst_type,
    },
    flags,
    price_range: {
      min: minVal !== "" ? Number(minVal) : null,
      max: maxVal !== "" ? Number(maxVal) : null,
    },
    match_mode: form.match_mode,
    scoring_weights: {
      title_keyword: num(form.w_title_keyword, 30),
      title_alias: num(form.w_title_alias, 15),
      category_exact: num(form.w_category_exact, 25),
      category_mid: num(form.w_category_mid, 15),
      category_large: num(form.w_category_large, 10),
      institution: num(form.w_institution, 10),
      flag: num(form.w_flag, 10),
      price_in_range: num(form.w_price_in, 5),
      price_out_range: num(form.w_price_out, -10),
    },
    scoring_thresholds: {
      high: num(form.th_high, 80),
      medium: num(form.th_medium, 50),
      low: num(form.th_low, 30),
    },
  };
}

function hasFilterSet(fc: FilterConditions | null | undefined): boolean {
  if (!fc) return false;
  if ((fc.title_keywords ?? []).length > 0) return true;
  if ((fc.title_exclude ?? []).length > 0) return true;
  if ((fc.search_aliases ?? []).length > 0) return true;
  if ((fc.institutions ?? []).length > 0) return true;
  if ((fc.categories?.pubPrcrmntLrgClsfcNm ?? []).length > 0) return true;
  if ((fc.categories?.pubPrcrmntClsfcNm ?? []).length > 0) return true;
  if ((fc.categories?.pubPrcrmntMidClsfcNm ?? []).length > 0) return true;
  if ((fc.categories?.dtilPrdctClsfcNoNm ?? []).length > 0) return true;
  if ((fc.categories?.sucsfbidMthdNm ?? []).length > 0) return true;
  if ((fc.categories?.bidMethdNm ?? []).length > 0) return true;
  if ((fc.categories?.cnstrtsiteRgnNm ?? []).length > 0) return true;
  if ((fc.categories?.rgstTyNm ?? []).length > 0) return true;
  if (fc.flags && Object.keys(fc.flags).length > 0) return true;
  if (fc.price_range?.min != null || fc.price_range?.max != null) return true;
  return false;
}

function formatPrice(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function priceHint(raw: string): string {
  const n = Number(raw.replace(/,/g, ""));
  if (!n) return "";
  if (n >= 100_000_000) {
    const uk = (n / 100_000_000).toFixed(2).replace(/\.?0+$/, "");
    return `≈ ${uk}억원`;
  }
  if (n >= 10_000) {
    const man = (n / 10_000).toFixed(1).replace(/\.?0+$/, "");
    return `≈ ${man}만원`;
  }
  return `${n.toLocaleString("ko-KR")}원`;
}

// ---- Add keyword form ----
interface AddKeywordForm {
  keyword: string;
  bid_types: string[];
  is_active: boolean;
}

const defaultForm: AddKeywordForm = { keyword: "", bid_types: [], is_active: true };

export default function BidKeywordsPage() {
  const [keywords, setKeywords] = useState<BidKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add keyword modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AddKeywordForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter modal
  const [filterTarget, setFilterTarget] = useState<BidKeyword | null>(null);
  const [filterForm, setFilterForm] = useState<FilterFormState>(defaultFilterForm);
  const [filterSubmitting, setFilterSubmitting] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  async function fetchKeywords() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords`, { credentials: "include" });
      if (!res.ok) throw new Error("키워드를 불러오지 못했습니다.");
      const data = await res.json();
      setKeywords(Array.isArray(data) ? data : data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeywords();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.keyword.trim()) {
      setFormError("키워드는 필수 입력 항목입니다.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        keyword: form.keyword.trim(),
        bid_types: form.bid_types,
        is_active: form.is_active,
      };
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "키워드 추가에 실패했습니다.");
      }
      setShowModal(false);
      setForm(defaultForm);
      await fetchKeywords();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 키워드를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("삭제에 실패했습니다.");
      await fetchKeywords();
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류가 발생했습니다.");
    }
  }

  async function handleToggleActive(kw: BidKeyword) {
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords/${kw.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !kw.is_active }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("상태 변경에 실패했습니다.");
      await fetchKeywords();
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류가 발생했습니다.");
    }
  }

  function toggleBidType(type: string) {
    setForm((f) => ({
      ...f,
      bid_types: f.bid_types.includes(type)
        ? f.bid_types.filter((t) => t !== type)
        : [...f.bid_types, type],
    }));
  }

  function openFilterModal(kw: BidKeyword) {
    setFilterTarget(kw);
    setFilterForm(filterConditionsToForm(kw.filter_conditions));
    setFilterError(null);
  }

  function closeFilterModal() {
    setFilterTarget(null);
    setFilterForm(defaultFilterForm);
    setFilterError(null);
  }

  async function handleSaveFilter() {
    if (!filterTarget) return;
    setFilterSubmitting(true);
    setFilterError(null);
    try {
      const conditions = formToFilterConditions(filterForm);
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords/${filterTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter_conditions: conditions }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "필터 저장에 실패했습니다.");
      }
      closeFilterModal();
      await fetchKeywords();
    } catch (e) {
      setFilterError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setFilterSubmitting(false);
    }
  }

  async function handleClearFilter() {
    if (!filterTarget) return;
    setFilterSubmitting(true);
    setFilterError(null);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords/${filterTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter_conditions: null }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("필터 초기화에 실패했습니다.");
      setFilterForm(defaultFilterForm);
      closeFilterModal();
      await fetchKeywords();
    } catch (e) {
      setFilterError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setFilterSubmitting(false);
    }
  }

  // ---- Helpers for filter form mutations ----
  type TagField = "title_keywords" | "title_exclude" | "search_aliases" | "institutions" | "lrg_clsfc" | "clsfc" | "mid_clsfc" | "product_clsfc" | "success_bid_method" | "bid_method" | "region" | "rgst_type";

  function addTag(field: TagField, tag: string) {
    setFilterForm((f) => ({ ...f, [field]: [...f[field], tag] }));
  }

  function removeTag(field: TagField, tag: string) {
    setFilterForm((f) => ({ ...f, [field]: f[field].filter((t: string) => t !== tag) }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 rounded-lg bg-negative-bg p-5 text-negative">
        <p className="font-semibold">오류가 발생했습니다</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold leading-tight text-text-primary">키워드 관리</h1>
          <p className="mt-1 text-sm text-text-tertiary">나라장터 입찰 공고 모니터링에 사용할 키워드를 관리합니다.</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setForm(defaultForm); setFormError(null); }}
          className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          + 키워드 추가
        </button>
      </div>

      {/* Keywords Table */}
      <div className="rounded-lg bg-surface-elevated shadow-md">
        {keywords.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-text-tertiary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10 opacity-40" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
            <p className="text-sm">등록된 키워드가 없습니다.</p>
            <button
              onClick={() => { setShowModal(true); setForm(defaultForm); setFormError(null); }}
              className="mt-1 text-sm font-medium text-brand hover:underline"
            >
              첫 번째 키워드 추가하기
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-secondary bg-surface-primary">
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">키워드</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">입찰 유형</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">필터</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">마지막 점검</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">활성</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {keywords.map((kw) => (
                  <tr key={kw.id} className="transition-colors hover:bg-surface-secondary">
                    <td className="px-6 py-3.5 font-semibold text-text-primary">{kw.keyword}</td>
                    <td className="px-6 py-3.5">
                      {kw.bid_types.length === 0 ? (
                        <span className="text-xs text-text-disabled">전체</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {kw.bid_types.map((t) => (
                            <BidTypeTag key={t} type={t} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {hasFilterSet(kw.filter_conditions) ? (
                        <span className="rounded-sm bg-positive-bg px-2 py-0.5 text-xs font-medium text-positive">
                          설정됨
                        </span>
                      ) : (
                        <span className="rounded-sm bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-disabled">
                          미설정
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-text-secondary">{formatKst(kw.last_checked_at)}</td>
                    <td className="px-6 py-3.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={kw.is_active}
                        onClick={() => handleToggleActive(kw)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 ${
                          kw.is_active ? "bg-brand" : "bg-surface-tertiary"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                            kw.is_active ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openFilterModal(kw)}
                          className="text-sm font-medium text-brand opacity-80 transition-opacity hover:opacity-100"
                        >
                          설정
                        </button>
                        <button
                          onClick={() => handleDelete(kw.id)}
                          className="text-sm font-medium text-negative opacity-70 transition-opacity hover:opacity-100"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Keyword Modal ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface-elevated p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[20px] font-semibold text-text-primary">키워드 추가</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-secondary"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
                  키워드 <span className="text-negative">*</span>
                </label>
                <input
                  type="text"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="예: 소프트웨어 개발"
                  className="w-full rounded-md bg-surface-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">입찰 유형</label>
                <div className="flex gap-2">
                  {BID_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.bid_types.includes(opt.value)}
                        onChange={() => toggleBidType(opt.value)}
                        className="h-4 w-4 rounded border-border-primary text-brand focus:ring-brand"
                      />
                      <span className="text-sm text-text-secondary">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[12px] text-text-disabled">미선택 시 모든 유형 포함</p>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">활성 여부</label>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_active}
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 ${
                      form.is_active ? "bg-brand" : "bg-surface-tertiary"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        form.is_active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-text-secondary">{form.is_active ? "활성" : "비활성"}</span>
                </label>
              </div>

              {/* Info note about filters */}
              <div className="rounded-md border border-border-secondary bg-surface-secondary px-3 py-2.5">
                <p className="text-[12px] text-text-tertiary">
                  키워드 추가 후 목록에서 <span className="font-medium text-brand">설정</span> 버튼을 눌러 상세 필터 조건을 구성할 수 있습니다.
                </p>
              </div>

              {formError && (
                <div className="rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-10 rounded-md px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 rounded-md bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
                >
                  {submitting ? "추가 중..." : "추가"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Filter Settings Modal ─────────────────────────── */}
      {filterTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-surface-elevated shadow-xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border-secondary px-6 py-5">
              <div>
                <h2 className="text-[20px] font-semibold text-text-primary">필터 설정</h2>
                <p className="mt-0.5 text-sm text-text-tertiary">
                  <span className="font-medium text-text-secondary">{filterTarget.keyword}</span> 키워드의 상세 필터 조건을 설정합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={closeFilterModal}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-secondary"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Modal Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6">

                {/* ── 공고명 ─────────────────────────────────── */}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border-secondary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">공고명</span>
                  <div className="h-px flex-1 bg-border-secondary" />
                </div>

                {/* Section 1: 공고명 키워드 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">1</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">공고명 키워드</h3>
                    <span className="text-[12px] text-text-disabled">(title_keywords)</span>
                  </div>
                  <p className="mb-2.5 text-[12px] text-text-tertiary">공고명에 반드시 포함되어야 할 키워드를 입력합니다.</p>
                  <TagInput
                    tags={filterForm.title_keywords}
                    onAdd={(t) => addTag("title_keywords", t)}
                    onRemove={(t) => removeTag("title_keywords", t)}
                    placeholder="예: 데이터, 빅데이터, AI"
                  />
                </div>

                <div className="border-t border-border-secondary" />

                {/* Section 2: 제외 키워드 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">2</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">제외 키워드</h3>
                    <span className="text-[12px] text-text-disabled">(title_exclude)</span>
                  </div>
                  <p className="mb-2.5 text-[12px] text-text-tertiary">공고명에 이 키워드가 포함된 경우 알림에서 제외합니다 (Hard exclude).</p>
                  <TagInput
                    tags={filterForm.title_exclude}
                    onAdd={(t) => addTag("title_exclude", t)}
                    onRemove={(t) => removeTag("title_exclude", t)}
                    placeholder="예: 엑스선, 배수로, 상수도"
                  />
                </div>

                <div className="border-t border-border-secondary" />

                {/* Section 2b: 유의어 (Stage 1 recall 확장용) */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-positive/10 text-[11px] font-bold text-positive">+</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">검색 유의어</h3>
                    <span className="text-[12px] text-text-disabled">(search_aliases)</span>
                  </div>
                  <p className="mb-2.5 text-[12px] text-text-tertiary">
                    나라장터 API에 추가 검색어로 활용됩니다. 누락 방지를 위해 주 키워드의 다른 표현을 등록하세요.
                  </p>
                  <TagInput
                    tags={filterForm.search_aliases}
                    onAdd={(t) => addTag("search_aliases", t)}
                    onRemove={(t) => removeTag("search_aliases", t)}
                    placeholder="예: 오픈데이터, 공공데이터 개방, DB구축"
                  />
                </div>

                {/* ── 기관 ─────────────────────────────────────── */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border-secondary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">기관</span>
                  <div className="h-px flex-1 bg-border-secondary" />
                </div>

                {/* Section 3: 공고기관/수요기관 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">3</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">공고기관 / 수요기관</h3>
                    <span className="text-[12px] text-text-disabled">(institutions)</span>
                  </div>
                  <p className="mb-2.5 text-[12px] text-text-tertiary">공고기관 또는 수요기관 이름으로 필터링합니다 (부분 매칭).</p>
                  <TagInput
                    tags={filterForm.institutions}
                    onAdd={(t) => addTag("institutions", t)}
                    onRemove={(t) => removeTag("institutions", t)}
                    placeholder="예: 조달청, 경상남도, 경북대학교"
                  />
                </div>

                {/* ── 분류 체계 ───────────────────────────────── */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border-secondary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">분류 체계</span>
                  <div className="h-px flex-1 bg-border-secondary" />
                </div>

                {/* Section 4: 대분류 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">4</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">대분류</h3>
                    <span className="text-[12px] text-text-disabled">(pubPrcrmntLrgClsfcNm)</span>
                  </div>
                  <TagInput
                    tags={filterForm.lrg_clsfc}
                    onAdd={(t) => addTag("lrg_clsfc", t)}
                    onRemove={(t) => removeTag("lrg_clsfc", t)}
                    placeholder="대분류 직접 입력"
                    suggestions={LRG_CLSFC_SUGGESTIONS}
                  />
                </div>

                <div className="border-t border-border-secondary" />

                {/* Section 5: 분류명 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">5</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">분류명</h3>
                    <span className="text-[12px] text-text-disabled">(pubPrcrmntClsfcNm)</span>
                  </div>
                  <TagInput
                    tags={filterForm.clsfc}
                    onAdd={(t) => addTag("clsfc", t)}
                    onRemove={(t) => removeTag("clsfc", t)}
                    placeholder="분류명 직접 입력"
                    suggestions={CLSFC_SUGGESTIONS}
                  />
                </div>

                <div className="border-t border-border-secondary" />

                {/* Section 6: 중분류 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">6</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">중분류</h3>
                    <span className="text-[12px] text-text-disabled">(pubPrcrmntMidClsfcNm)</span>
                  </div>
                  <TagInput
                    tags={filterForm.mid_clsfc}
                    onAdd={(t) => addTag("mid_clsfc", t)}
                    onRemove={(t) => removeTag("mid_clsfc", t)}
                    placeholder="예: DB구축 및 자료입력"
                    suggestions={MID_CLSFC_SUGGESTIONS}
                  />
                </div>

                <div className="border-t border-border-secondary" />

                {/* Section 7: 세부품목분류 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">7</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">세부품목분류</h3>
                    <span className="text-[12px] text-text-disabled">(dtilPrdctClsfcNoNm)</span>
                  </div>
                  <TagInput
                    tags={filterForm.product_clsfc}
                    onAdd={(t) => addTag("product_clsfc", t)}
                    onRemove={(t) => removeTag("product_clsfc", t)}
                    placeholder="예: AI서버"
                    suggestions={PRODUCT_CLSFC_SUGGESTIONS}
                  />
                </div>

                {/* ── 입찰 정보 ───────────────────────────────── */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border-secondary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">입찰 정보</span>
                  <div className="h-px flex-1 bg-border-secondary" />
                </div>

                {/* Section 8: 낙찰방법 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">8</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">낙찰방법</h3>
                    <span className="text-[12px] text-text-disabled">(sucsfbidMthdNm)</span>
                  </div>
                  <TagInput
                    tags={filterForm.success_bid_method}
                    onAdd={(t) => addTag("success_bid_method", t)}
                    onRemove={(t) => removeTag("success_bid_method", t)}
                    placeholder="예: 협상에의한계약"
                    suggestions={SUCCESS_BID_SUGGESTIONS}
                  />
                </div>

                <div className="border-t border-border-secondary" />

                {/* Section 9: 입찰방법 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">9</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">입찰방법</h3>
                    <span className="text-[12px] text-text-disabled">(bidMethdNm)</span>
                  </div>
                  <TagInput
                    tags={filterForm.bid_method}
                    onAdd={(t) => addTag("bid_method", t)}
                    onRemove={(t) => removeTag("bid_method", t)}
                    placeholder="예: 전자입찰"
                    suggestions={BID_METHOD_SUGGESTIONS}
                  />
                </div>

                <div className="border-t border-border-secondary" />

                {/* Section 10: 등록유형 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">10</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">등록유형</h3>
                    <span className="text-[12px] text-text-disabled">(rgstTyNm)</span>
                  </div>
                  <TagInput
                    tags={filterForm.rgst_type}
                    onAdd={(t) => addTag("rgst_type", t)}
                    onRemove={(t) => removeTag("rgst_type", t)}
                    placeholder="예: 조달청 또는 나라장터 자체 공고건"
                    suggestions={RGST_TYPE_SUGGESTIONS}
                  />
                </div>

                {/* ── 지역 ─────────────────────────────────────── */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border-secondary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">지역</span>
                  <div className="h-px flex-1 bg-border-secondary" />
                </div>

                {/* Section 11: 지역 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">11</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">지역</h3>
                    <span className="text-[12px] text-text-disabled">(cnstrtsiteRgnNm)</span>
                  </div>
                  <TagInput
                    tags={filterForm.region}
                    onAdd={(t) => addTag("region", t)}
                    onRemove={(t) => removeTag("region", t)}
                    placeholder="예: 서울특별시"
                    suggestions={REGION_SUGGESTIONS}
                  />
                </div>

                {/* ── 플래그 필터 ─────────────────────────────── */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border-secondary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">플래그 필터</span>
                  <div className="h-px flex-1 bg-border-secondary" />
                </div>

                {/* Section 12: 플래그 필터 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">12</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">플래그 필터</h3>
                    <span className="text-[12px] text-text-disabled">(flags)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[12px] text-text-tertiary">정보화사업</label>
                      <select
                        value={filterForm.info_biz_yn}
                        onChange={(e) => setFilterForm((f) => ({ ...f, info_biz_yn: e.target.value as "전체" | "Y" | "N" }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="전체">전체</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-text-tertiary">재공고</label>
                      <select
                        value={filterForm.re_ntce_yn}
                        onChange={(e) => setFilterForm((f) => ({ ...f, re_ntce_yn: e.target.value as "전체" | "Y" | "N" }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="전체">전체</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-text-tertiary">업종제한</label>
                      <select
                        value={filterForm.indstryty_lmt_yn}
                        onChange={(e) => setFilterForm((f) => ({ ...f, indstryty_lmt_yn: e.target.value as "전체" | "Y" | "N" }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="전체">전체</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-text-tertiary">물품분류제한</label>
                      <select
                        value={filterForm.prdct_clsfc_lmt_yn}
                        onChange={(e) => setFilterForm((f) => ({ ...f, prdct_clsfc_lmt_yn: e.target.value as "전체" | "Y" | "N" }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="전체">전체</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-text-tertiary">지명경쟁</label>
                      <select
                        value={filterForm.dsgnt_cmpt_yn}
                        onChange={(e) => setFilterForm((f) => ({ ...f, dsgnt_cmpt_yn: e.target.value as "전체" | "Y" | "N" }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="전체">전체</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-text-tertiary">실적경쟁</label>
                      <select
                        value={filterForm.arslt_cmpt_yn}
                        onChange={(e) => setFilterForm((f) => ({ ...f, arslt_cmpt_yn: e.target.value as "전체" | "Y" | "N" }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="전체">전체</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-text-tertiary">일반용역</label>
                      <select
                        value={filterForm.ppsw_gnrl_srvce_yn}
                        onChange={(e) => setFilterForm((f) => ({ ...f, ppsw_gnrl_srvce_yn: e.target.value as "전체" | "Y" | "N" }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <option value="전체">전체</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── 금액 범위 ───────────────────────────────── */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border-secondary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">금액 범위</span>
                  <div className="h-px flex-1 bg-border-secondary" />
                </div>

                {/* Section 13: 금액 범위 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">13</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">금액 범위</h3>
                    <span className="text-[12px] text-text-disabled">(price_range)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">최소 금액</label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={filterForm.price_min}
                          onChange={(e) =>
                            setFilterForm((f) => ({
                              ...f,
                              price_min: formatPrice(e.target.value),
                            }))
                          }
                          placeholder="0"
                          className="w-full rounded-md bg-surface-secondary px-3 py-2.5 pr-8 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-disabled">원</span>
                      </div>
                      {filterForm.price_min && (
                        <p className="mt-1 text-[12px] text-text-tertiary">{priceHint(filterForm.price_min)}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">최대 금액</label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={filterForm.price_max}
                          onChange={(e) =>
                            setFilterForm((f) => ({
                              ...f,
                              price_max: formatPrice(e.target.value),
                            }))
                          }
                          placeholder="제한 없음"
                          className="w-full rounded-md bg-surface-secondary px-3 py-2.5 pr-8 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-disabled">원</span>
                      </div>
                      {filterForm.price_max && (
                        <p className="mt-1 text-[12px] text-text-tertiary">{priceHint(filterForm.price_max)}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── 스코어링 ────────────────────────────────── */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border-secondary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">스코어링 (가중치 · 등급)</span>
                  <div className="h-px flex-1 bg-border-secondary" />
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">S</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">시그널 가중치</h3>
                    <span className="text-[12px] text-text-disabled">(scoring_weights)</span>
                  </div>
                  <p className="mb-3 text-[12px] text-text-tertiary">
                    각 시그널이 공고 점수에 기여하는 크기입니다. 합계가 100을 초과하면 100으로 클램핑됩니다.
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {([
                      { key: "w_title_keyword", label: "제목 키워드" },
                      { key: "w_title_alias", label: "제목 유의어" },
                      { key: "w_category_exact", label: "분류 (정확)" },
                      { key: "w_category_mid", label: "분류 (중분류)" },
                      { key: "w_category_large", label: "분류 (대분류)" },
                      { key: "w_institution", label: "기관 매칭" },
                      { key: "w_flag", label: "플래그 (건당)" },
                      { key: "w_price_in", label: "가격 범위 내" },
                      { key: "w_price_out", label: "가격 범위 밖" },
                    ] as const).map((w) => (
                      <div key={w.key}>
                        <label className="mb-1 block text-[12px] text-text-tertiary">{w.label}</label>
                        <input
                          type="number"
                          value={filterForm[w.key]}
                          onChange={(e) => setFilterForm((f) => ({ ...f, [w.key]: e.target.value }))}
                          className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border-secondary" />

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">T</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">등급 임계값</h3>
                    <span className="text-[12px] text-text-disabled">(scoring_thresholds · 0~100)</span>
                  </div>
                  <p className="mb-3 text-[12px] text-text-tertiary">
                    점수가 임계값 이상이면 해당 등급으로 분류됩니다. 낮을수록 더 많은 공고가 포함됩니다.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-[12px] text-red-600">High</label>
                      <input
                        type="number"
                        value={filterForm.th_high}
                        onChange={(e) => setFilterForm((f) => ({ ...f, th_high: e.target.value }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-amber-600">Medium</label>
                      <input
                        type="number"
                        value={filterForm.th_medium}
                        onChange={(e) => setFilterForm((f) => ({ ...f, th_medium: e.target.value }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-slate-600">Low</label>
                      <input
                        type="number"
                        value={filterForm.th_low}
                        onChange={(e) => setFilterForm((f) => ({ ...f, th_low: e.target.value }))}
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                  </div>
                </div>

                {/* ── 매칭 모드 ───────────────────────────────── */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border-secondary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-disabled">매칭 모드 (레거시 · 참고용)</span>
                  <div className="h-px flex-1 bg-border-secondary" />
                </div>

                {/* Section 14: 매칭 모드 */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">14</span>
                    <h3 className="text-[13px] font-semibold text-text-primary">매칭 모드</h3>
                    <span className="text-[12px] text-text-disabled">(match_mode)</span>
                  </div>
                  <div className="space-y-2">
                    {(
                      [
                        {
                          value: "any",
                          label: "OR 조건 — 하나라도 충족하면 알림",
                          desc: "설정된 조건 중 하나라도 만족하는 공고에 알림을 보냅니다.",
                        },
                        {
                          value: "all",
                          label: "AND 조건 — 모든 조건 충족해야 알림",
                          desc: "설정된 모든 조건을 동시에 만족하는 공고에만 알림을 보냅니다.",
                        },
                      ] as const
                    ).map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                          filterForm.match_mode === option.value
                            ? "border-brand bg-brand/5"
                            : "border-border-secondary bg-surface-secondary hover:border-brand/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="match_mode"
                          value={option.value}
                          checked={filterForm.match_mode === option.value}
                          onChange={() => setFilterForm((f) => ({ ...f, match_mode: option.value }))}
                          className="mt-0.5 h-4 w-4 shrink-0 text-brand focus:ring-brand"
                        />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{option.label}</p>
                          <p className="mt-0.5 text-[12px] text-text-tertiary">{option.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 border-t border-border-secondary px-6 py-4">
              {filterError && (
                <div className="mb-3 rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">
                  {filterError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleClearFilter}
                  disabled={filterSubmitting}
                  className="h-9 rounded-md px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-secondary disabled:opacity-50"
                >
                  초기화
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeFilterModal}
                    disabled={filterSubmitting}
                    className="h-9 rounded-md px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-secondary disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFilter}
                    disabled={filterSubmitting}
                    className="h-9 rounded-md bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
                  >
                    {filterSubmitting ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
