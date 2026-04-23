"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { BidMonitorStats, BidMonitorConfig, BidNotice, BidKeyword, FilterConditions } from "@/lib/types";
import { formatKst, timeAgoKst } from "@/lib/datetime";

const API_BASE = "/api";

// ── Constants ──────────────────────────────────────────────────────────────

const BID_TYPE_OPTIONS = [
  { value: "goods", label: "물품", bg: "bg-blue-50", text: "text-blue-600" },
  { value: "services", label: "용역", bg: "bg-purple-50", text: "text-purple-600" },
  { value: "construction", label: "공사", bg: "bg-amber-50", text: "text-amber-600" },
];

const SORT_OPTIONS = [
  { value: "score", label: "점수순" },
  { value: "date", label: "최신순" },
  { value: "price", label: "가격순" },
  { value: "deadline", label: "마감순" },
];

const GRADE_TABS = [
  { value: "", label: "전체", dot: "bg-text-disabled" },
  { value: "high", label: "High", dot: "bg-red-500" },
  { value: "medium", label: "Medium", dot: "bg-amber-500" },
  { value: "low", label: "Low", dot: "bg-slate-400" },
];

const GRADE_STYLES: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-red-50", text: "text-red-600" },
  medium: { bg: "bg-amber-50", text: "text-amber-600" },
  low: { bg: "bg-slate-100", text: "text-slate-600" },
};

const LRG_CLSFC_SUGGESTIONS = ["ICT 서비스", "연구조사서비스", "기술용역", "교육 및 전문직종/기술서비스"];
const CLSFC_SUGGESTIONS = ["데이터서비스", "정보시스템개발서비스", "정보화전략계획서비스", "정보보안서비스", "소프트웨어개발서비스"];
const MID_CLSFC_SUGGESTIONS = ["DB구축 및 자료입력", "학술연구서비스", "ICT사업 컨설팅"];
const SUCCESS_BID_SUGGESTIONS = ["협상에의한계약", "수의시담", "규격가격동시입찰", "최저가낙찰제"];
const BID_METHOD_SUGGESTIONS = ["전자입찰", "전자시담", "직찰"];
const REGION_SUGGESTIONS = ["서울특별시", "경기도", "부산광역시", "대전광역시", "세종특별자치시"];
const RGST_TYPE_SUGGESTIONS = ["조달청 또는 나라장터 자체 공고건"];

// ── Helper components ──────────────────────────────────────────────────────

function ScoreBadge({ score, grade }: { score?: number | null; grade?: string | null }) {
  if (score == null || !grade) return null;
  const cfg = GRADE_STYLES[grade] ?? { bg: "bg-surface-secondary", text: "text-text-secondary" };
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {score.toFixed(0)}점
    </span>
  );
}

function BidTypeBadge({ type }: { type: string }) {
  const opt = BID_TYPE_OPTIONS.find((o) => o.value === type);
  if (!opt) return <span className="rounded-sm bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">{type}</span>;
  return <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${opt.bg} ${opt.text}`}>{opt.label}</span>;
}

function formatPrice(amount: number | null): string {
  if (amount === null) return "—";
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000);
    const man = Math.floor((amount % 100_000_000) / 10_000);
    return man > 0 ? `${eok.toLocaleString()}억 ${man.toLocaleString()}만원` : `${eok.toLocaleString()}억원`;
  }
  if (amount >= 10_000) return `${Math.floor(amount / 10_000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

function formatPriceInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function priceHint(raw: string): string {
  const n = Number(raw.replace(/,/g, ""));
  if (!n) return "";
  if (n >= 100_000_000) return `≈ ${(n / 100_000_000).toFixed(2).replace(/\.?0+$/, "")}억원`;
  if (n >= 10_000) return `≈ ${(n / 10_000).toFixed(1).replace(/\.?0+$/, "")}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

// ── TagInput ───────────────────────────────────────────────────────────────

function TagInput({ tags, onAdd, onRemove, placeholder, suggestions }: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function doAdd() {
    const t = val.trim();
    if (t && !tags.includes(t)) onAdd(t);
    setVal("");
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input ref={inputRef} type="text" value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doAdd(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand" />
        <button type="button" onClick={doAdd} disabled={!val.trim()}
          className="h-9 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40">추가</button>
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => { if (!tags.includes(s)) onAdd(s); }} disabled={tags.includes(s)}
              className={`rounded-sm px-2 py-0.5 text-xs font-medium transition-colors ${tags.includes(s) ? "bg-brand/10 text-brand cursor-default" : "bg-surface-secondary text-text-secondary hover:bg-brand/10 hover:text-brand"}`}>
              {tags.includes(s) ? "✓ " : "+ "}{s}
            </button>
          ))}
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-sm bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              {tag}
              <button type="button" onClick={() => onRemove(tag)} className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-brand/60 hover:bg-brand/20 hover:text-brand">
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

// ── Filter form types ──────────────────────────────────────────────────────

interface FilterFormState {
  title_keywords: string[]; title_exclude: string[]; search_aliases: string[]; institutions: string[];
  lrg_clsfc: string[]; clsfc: string[]; mid_clsfc: string[]; product_clsfc: string[];
  success_bid_method: string[]; bid_method: string[]; region: string[]; rgst_type: string[];
  info_biz_yn: "전체" | "Y" | "N"; re_ntce_yn: "전체" | "Y" | "N";
  indstryty_lmt_yn: "전체" | "Y" | "N"; prdct_clsfc_lmt_yn: "전체" | "Y" | "N";
  dsgnt_cmpt_yn: "전체" | "Y" | "N"; arslt_cmpt_yn: "전체" | "Y" | "N";
  ppsw_gnrl_srvce_yn: "전체" | "Y" | "N";
  price_min: string; price_max: string; match_mode: "any" | "all";
  w_title_keyword: string; w_title_alias: string; w_category_exact: string;
  w_category_mid: string; w_category_large: string; w_institution: string;
  w_flag: string; w_price_in: string; w_price_out: string;
  th_high: string; th_medium: string; th_low: string;
}

const defaultFilterForm: FilterFormState = {
  title_keywords: [], title_exclude: [], search_aliases: [], institutions: [],
  lrg_clsfc: [], clsfc: [], mid_clsfc: [], product_clsfc: [],
  success_bid_method: [], bid_method: [], region: [], rgst_type: [],
  info_biz_yn: "전체", re_ntce_yn: "전체", indstryty_lmt_yn: "전체", prdct_clsfc_lmt_yn: "전체",
  dsgnt_cmpt_yn: "전체", arslt_cmpt_yn: "전체", ppsw_gnrl_srvce_yn: "전체",
  price_min: "", price_max: "", match_mode: "any",
  w_title_keyword: "30", w_title_alias: "15", w_category_exact: "25",
  w_category_mid: "15", w_category_large: "10", w_institution: "10",
  w_flag: "10", w_price_in: "5", w_price_out: "-10",
  th_high: "80", th_medium: "50", th_low: "30",
};

function fcToForm(fc: FilterConditions | null | undefined): FilterFormState {
  if (!fc) return defaultFilterForm;
  const w = fc.scoring_weights ?? {};
  const th = fc.scoring_thresholds ?? {};
  const ns = (v: number | undefined, d: string) => (v != null ? String(v) : d);
  return {
    title_keywords: fc.title_keywords ?? [], title_exclude: fc.title_exclude ?? [],
    search_aliases: fc.search_aliases ?? [], institutions: fc.institutions ?? [],
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
    w_title_keyword: ns(w.title_keyword, "30"), w_title_alias: ns(w.title_alias, "15"),
    w_category_exact: ns(w.category_exact, "25"), w_category_mid: ns(w.category_mid, "15"),
    w_category_large: ns(w.category_large, "10"), w_institution: ns(w.institution, "10"),
    w_flag: ns(w.flag, "10"), w_price_in: ns(w.price_in_range, "5"),
    w_price_out: ns(w.price_out_range, "-10"),
    th_high: ns(th.high, "80"), th_medium: ns(th.medium, "50"), th_low: ns(th.low, "30"),
  };
}

function formToFc(f: FilterFormState): FilterConditions {
  const num = (s: string, d: number) => { const n = Number(s); return Number.isFinite(n) ? n : d; };
  const flags: Record<string, string> = {};
  if (f.info_biz_yn !== "전체") flags.infoBizYn = f.info_biz_yn;
  if (f.re_ntce_yn !== "전체") flags.reNtceYn = f.re_ntce_yn;
  if (f.indstryty_lmt_yn !== "전체") flags.indstrytyLmtYn = f.indstryty_lmt_yn;
  if (f.prdct_clsfc_lmt_yn !== "전체") flags.prdctClsfcLmtYn = f.prdct_clsfc_lmt_yn;
  if (f.dsgnt_cmpt_yn !== "전체") flags.dsgntCmptYn = f.dsgnt_cmpt_yn;
  if (f.arslt_cmpt_yn !== "전체") flags.arsltCmptYn = f.arslt_cmpt_yn;
  if (f.ppsw_gnrl_srvce_yn !== "전체") flags.ppswGnrlSrvceYn = f.ppsw_gnrl_srvce_yn;
  const minV = f.price_min.replace(/,/g, ""), maxV = f.price_max.replace(/,/g, "");
  return {
    title_keywords: f.title_keywords, title_exclude: f.title_exclude,
    search_aliases: f.search_aliases, institutions: f.institutions,
    categories: {
      pubPrcrmntLrgClsfcNm: f.lrg_clsfc, pubPrcrmntClsfcNm: f.clsfc,
      pubPrcrmntMidClsfcNm: f.mid_clsfc, dtilPrdctClsfcNoNm: f.product_clsfc,
      sucsfbidMthdNm: f.success_bid_method, bidMethdNm: f.bid_method,
      cnstrtsiteRgnNm: f.region, rgstTyNm: f.rgst_type,
    },
    flags,
    price_range: { min: minV !== "" ? Number(minV) : null, max: maxV !== "" ? Number(maxV) : null },
    match_mode: f.match_mode,
    scoring_weights: {
      title_keyword: num(f.w_title_keyword, 30), title_alias: num(f.w_title_alias, 15),
      category_exact: num(f.w_category_exact, 25), category_mid: num(f.w_category_mid, 15),
      category_large: num(f.w_category_large, 10), institution: num(f.w_institution, 10),
      flag: num(f.w_flag, 10), price_in_range: num(f.w_price_in, 5), price_out_range: num(f.w_price_out, -10),
    },
    scoring_thresholds: { high: num(f.th_high, 80), medium: num(f.th_medium, 50), low: num(f.th_low, 30) },
  };
}

function hasFilter(fc: FilterConditions | null | undefined): boolean {
  if (!fc) return false;
  return (fc.title_keywords ?? []).length > 0 || (fc.title_exclude ?? []).length > 0
    || (fc.search_aliases ?? []).length > 0 || (fc.institutions ?? []).length > 0
    || Object.values(fc.categories ?? {}).some((v) => (v ?? []).length > 0)
    || (fc.flags && Object.keys(fc.flags).length > 0)
    || fc.price_range?.min != null || fc.price_range?.max != null;
}

// ── CloseButton ───────────────────────────────────────────────────────────

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-secondary">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

function BidMonitorPageContent() {
  const searchParams = useSearchParams();
  const initialGrade = searchParams?.get("grade") ?? "";

  // Stats
  const [stats, setStats] = useState<BidMonitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Notice list
  const [notices, setNotices] = useState<BidNotice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<BidNotice | null>(null);
  const [pastNotices, setPastNotices] = useState<Array<{
    id: string; bid_ntce_no: string; bid_ntce_nm: string;
    dminstt_nm?: string | null; ntce_instt_nm?: string | null;
    bid_ntce_dt?: string | null; bid_ntce_url?: string | null;
    bid_ntce_dtl_url?: string | null; matched_keywords: string[];
    presmpt_prce?: number | null; similarity_score?: number | null;
  }>>([]);
  const [pastLoading, setPastLoading] = useState(false);

  // Search filters
  const [keyword, setKeyword] = useState("");
  const [bidType, setBidType] = useState("");
  const [sort, setSort] = useState("score");
  const [gradeFilters, setGradeFilters] = useState<string[]>(initialGrade ? [initialGrade] : []);
  const pageSize = 15;
  const abortControllerRef = useRef<AbortController | null>(null);

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"settings" | "keywords">("settings");
  const [config, setConfig] = useState<BidMonitorConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [backfillHours, setBackfillHours] = useState("24");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Keywords state
  const [keywords, setKeywords] = useState<BidKeyword[]>([]);
  const [kwLoading, setKwLoading] = useState(false);
  const [showAddKw, setShowAddKw] = useState(false);
  const [addKwForm, setAddKwForm] = useState({ keyword: "", bid_types: [] as string[], is_active: true });
  const [addKwError, setAddKwError] = useState<string | null>(null);
  const [addKwSubmitting, setAddKwSubmitting] = useState(false);
  const [filterTarget, setFilterTarget] = useState<BidKeyword | null>(null);
  const [filterForm, setFilterForm] = useState<FilterFormState>(defaultFilterForm);
  const [filterSubmitting, setFilterSubmitting] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  // ── Fetch functions ──────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("통계를 불러오지 못했습니다.");
      setStats(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotices = useCallback(async (pageNum: number) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setNoticesLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), page_size: String(pageSize), sort });
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (bidType) params.set("bid_type", bidType);
      for (const g of gradeFilters) params.append("grade", g);
      const res = await fetch(`${API_BASE}/projects/bid-monitor/notices?${params}`, { credentials: "include", signal: controller.signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (Array.isArray(data)) { setNotices(data); setTotal(data.length); setTotalPages(1); }
      else { setNotices(data.items ?? []); setTotal(data.total ?? 0); setTotalPages(data.total_pages ?? 1); }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setNotices([]);
    } finally {
      if (!controller.signal.aborted) setNoticesLoading(false);
    }
  }, [keyword, bidType, sort, gradeFilters]);

  async function fetchKeywords() {
    setKwLoading(true);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setKeywords(Array.isArray(data) ? data : data.items ?? []);
    } finally {
      setKwLoading(false);
    }
  }

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); }, [keyword, bidType, sort, gradeFilters]);
  useEffect(() => { fetchNotices(page); }, [fetchNotices, page]);

  useEffect(() => {
    if (!selectedNotice) { setPastNotices([]); return; }
    let cancelled = false;
    setPastLoading(true);
    setPastNotices([]);
    fetch(`${API_BASE}/projects/bid-monitor/notices/${selectedNotice.id}/similar-past?limit=10`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setPastNotices(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setPastNotices([]); })
      .finally(() => { if (!cancelled) setPastLoading(false); });
    return () => { cancelled = true; };
  }, [selectedNotice]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleTrigger() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/check/trigger`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include" });
      if (!res.ok) throw new Error("수동 점검 실행에 실패했습니다.");
      await res.json();
      setTriggerMsg({ text: "점검 완료", ok: true });
      await Promise.all([fetchStats(), fetchNotices(page)]);
    } catch (e) {
      setTriggerMsg({ text: e instanceof Error ? e.message : "오류가 발생했습니다.", ok: false });
    } finally {
      setTriggering(false);
    }
  }

  async function openSettings() {
    setSettingsOpen(true);
    if (!config) {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/config`, { credentials: "include" });
      if (res.ok) { const d: BidMonitorConfig = await res.json(); setConfig(d); setWebhookUrl(d.discord_webhook_url ?? ""); }
    }
  }

  async function handleSaveWebhook(e: React.FormEvent) {
    e.preventDefault();
    setSavingWebhook(true);
    setWebhookMsg(null);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/config`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_webhook_url: webhookUrl.trim() || null }), credentials: "include",
      });
      if (!res.ok) throw new Error("저장에 실패했습니다.");
      setConfig(await res.json());
      setWebhookMsg({ text: "저장되었습니다.", ok: true });
    } catch (e) {
      setWebhookMsg({ text: e instanceof Error ? e.message : "오류", ok: false });
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleBackfill(hours: number) {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/check/backfill`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }), credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `백필 실행 실패 (HTTP ${res.status})`);
      }
      const s = await res.json();
      setBackfillMsg({ text: `완료: 수집 ${s.total_fetched ?? 0} · 신규 ${s.total_new ?? 0} · H ${s.grade_high ?? 0} M ${s.grade_medium ?? 0} L ${s.grade_low ?? 0}`, ok: true });
      await Promise.all([fetchStats(), fetchNotices(page)]);
    } catch (e) {
      setBackfillMsg({ text: e instanceof Error ? e.message : "오류", ok: false });
    } finally {
      setBackfilling(false);
    }
  }

  function openKeywordsTab() {
    setSettingsTab("keywords");
    if (keywords.length === 0) fetchKeywords();
  }

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!addKwForm.keyword.trim()) { setAddKwError("키워드를 입력하세요."); return; }
    setAddKwSubmitting(true);
    setAddKwError(null);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: addKwForm.keyword.trim(), bid_types: addKwForm.bid_types, is_active: addKwForm.is_active }),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? "추가 실패");
      setShowAddKw(false);
      setAddKwForm({ keyword: "", bid_types: [], is_active: true });
      await fetchKeywords();
    } catch (e) {
      setAddKwError(e instanceof Error ? e.message : "오류");
    } finally {
      setAddKwSubmitting(false);
    }
  }

  async function handleDeleteKeyword(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`${API_BASE}/projects/bid-monitor/keywords/${id}`, { method: "DELETE", credentials: "include" });
    await fetchKeywords();
  }

  async function handleToggleKeyword(kw: BidKeyword) {
    await fetch(`${API_BASE}/projects/bid-monitor/keywords/${kw.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !kw.is_active }), credentials: "include",
    });
    await fetchKeywords();
  }

  function openFilterModal(kw: BidKeyword) {
    setFilterTarget(kw);
    setFilterForm(fcToForm(kw.filter_conditions));
    setFilterError(null);
  }

  async function handleSaveFilter() {
    if (!filterTarget) return;
    setFilterSubmitting(true);
    setFilterError(null);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords/${filterTarget.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter_conditions: formToFc(filterForm) }), credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? "저장 실패");
      setFilterTarget(null);
      await fetchKeywords();
    } catch (e) {
      setFilterError(e instanceof Error ? e.message : "오류");
    } finally {
      setFilterSubmitting(false);
    }
  }

  async function handleClearFilter() {
    if (!filterTarget) return;
    setFilterSubmitting(true);
    try {
      await fetch(`${API_BASE}/projects/bid-monitor/keywords/${filterTarget.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter_conditions: null }), credentials: "include",
      });
      setFilterTarget(null);
      await fetchKeywords();
    } finally {
      setFilterSubmitting(false);
    }
  }

  type TagField = "title_keywords" | "title_exclude" | "search_aliases" | "institutions" | "lrg_clsfc" | "clsfc" | "mid_clsfc" | "product_clsfc" | "success_bid_method" | "bid_method" | "region" | "rgst_type";
  const addTag = (field: TagField, tag: string) => setFilterForm((f) => ({ ...f, [field]: [...f[field], tag] }));
  const removeTag = (field: TagField, tag: string) => setFilterForm((f) => ({ ...f, [field]: f[field].filter((t: string) => t !== tag) }));

  // ── Early returns ─────────────────────────────────────────────────────────

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" /></div>;
  if (error) return <div className="m-6 rounded-lg bg-negative-bg p-5 text-negative"><p className="font-semibold">오류가 발생했습니다</p><p className="mt-1 text-sm">{error}</p></div>;

  const lastRun = stats?.recent_runs?.[0];
  const runStats = lastRun?.statistics ?? {};
  const selectClass = "h-9 rounded-md bg-surface-secondary px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold leading-tight text-text-primary">입찰 공고 모니터</h1>
          <p className="mt-1 text-sm text-text-tertiary">나라장터 입찰 공고를 스코어링해 등급별로 분류·알림합니다.</p>
        </div>
        <button onClick={openSettings} className="inline-flex h-9 items-center rounded-md bg-surface-secondary px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary">설정</button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
          <div className="rounded-lg bg-surface-elevated shadow-md lg:col-span-5">
            <div className="grid grid-cols-2 divide-x divide-y divide-border-secondary sm:grid-cols-5 sm:divide-y-0">
              {[
                { label: "활성 키워드", value: stats.active_keywords, suffix: `/ ${stats.total_keywords}`, cls: "text-text-primary" },
                { label: "수집된 공고", value: stats.total_notices.toLocaleString(), cls: "text-text-primary" },
                { label: "High", value: (stats.high_count ?? 0).toLocaleString(), cls: "text-red-600", dot: "bg-red-500" },
                { label: "Medium", value: (stats.medium_count ?? 0).toLocaleString(), cls: "text-amber-600", dot: "bg-amber-500" },
                { label: "Low", value: (stats.low_count ?? 0).toLocaleString(), cls: "text-slate-600", dot: "bg-slate-400" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col gap-2 px-5 py-4">
                  <p className="h-4 inline-flex items-center gap-1.5 text-[12px] leading-4 text-text-tertiary">
                    {s.dot && <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />}{s.label}
                  </p>
                  <p className={`text-[22px] font-bold leading-none ${s.cls}`}>
                    {s.value}{s.suffix && <span className="ml-1 text-[13px] font-normal text-text-tertiary">{s.suffix}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-2 rounded-lg bg-surface-elevated px-5 py-4 shadow-md lg:col-span-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              {stats.scheduler_running ? (
                <span className="inline-flex items-center gap-1 font-medium text-positive"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" /> 스케줄러 실행중</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-text-tertiary"><span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" /> 스케줄러 중지됨</span>
              )}
              {lastRun ? <span className="text-text-tertiary">마지막 점검 <strong className="text-text-primary">{timeAgoKst(lastRun.started_at)}</strong></span> : <span className="text-text-tertiary">실행 이력 없음</span>}
              {triggerMsg && <span className={`ml-auto text-[11px] font-medium ${triggerMsg.ok ? "text-positive" : "text-negative"}`}>{triggerMsg.text}</span>}
            </div>
            {lastRun && (runStats.total_fetched !== undefined || runStats.total_new > 0 || runStats.grade_high > 0) && (
              <div className="flex flex-wrap items-center gap-1">
                {runStats.total_fetched !== undefined && <span className="rounded-sm bg-surface-secondary px-1.5 py-0.5 text-[11px] text-text-secondary">수집 {runStats.total_fetched}</span>}
                {runStats.total_new > 0 && <span className="rounded-sm bg-brand-light px-1.5 py-0.5 text-[11px] text-brand">신규 {runStats.total_new}</span>}
                {runStats.grade_high > 0 && <span className="rounded-sm bg-red-50 px-1.5 py-0.5 text-[11px] text-red-600">High {runStats.grade_high}</span>}
                {runStats.grade_medium > 0 && <span className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-600">Medium {runStats.grade_medium}</span>}
                {runStats.grade_low > 0 && <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">Low {runStats.grade_low}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notice list */}
      <div className="rounded-lg bg-surface-elevated shadow-md">
        <div className="flex flex-wrap items-center gap-2 border-b border-border-secondary px-6 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {GRADE_TABS.map((tab) => (
              <button key={tab.value}
                onClick={() => tab.value === "" ? setGradeFilters([]) : setGradeFilters((prev) => prev.includes(tab.value) ? prev.filter((g) => g !== tab.value) : [...prev, tab.value])}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${(tab.value === "" ? gradeFilters.length === 0 : gradeFilters.includes(tab.value)) ? "border-brand bg-brand/10 text-brand" : "border-border-secondary bg-surface-elevated text-text-secondary hover:border-brand/40"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tab.dot}`} />{tab.label}
              </button>
            ))}
          </div>
          <span className="mx-1 hidden h-6 w-px bg-border-secondary sm:inline-block" />
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="공고명 검색..."
            className="h-9 min-w-[180px] flex-1 rounded-md bg-surface-secondary px-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand" />
          <select value={bidType} onChange={(e) => setBidType(e.target.value)} className={selectClass}>
            <option value="">전체 유형</option>
            {BID_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-between border-b border-border-primary px-6 py-3">
          <h2 className="text-[14px] font-semibold text-text-primary">
            {gradeFilters.length === 1 ? ({ high: "High 등급 공고", medium: "Medium 등급 공고", low: "Low 등급 공고" }[gradeFilters[0]] ?? "검색 결과")
              : gradeFilters.length > 1 ? gradeFilters.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(" · ") + " 등급 공고"
              : "검색 결과"}
            {total > 0 && <span className="ml-2 text-sm font-normal text-text-tertiary">{total.toLocaleString()}건</span>}
          </h2>
        </div>

        {noticesLoading ? (
          <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" /></div>
        ) : notices.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-text-tertiary">
            {gradeFilters.length > 0 ? `${gradeFilters.join(", ")} 등급 공고가 없습니다.` : "검색 결과가 없습니다."}
          </div>
        ) : (
          <div className="divide-y divide-border-secondary">
            {notices.map((notice) => (
              <div key={notice.id} className="cursor-pointer px-6 py-4 transition-colors hover:bg-surface-secondary" onClick={() => setSelectedNotice(notice)}>
                <h3 className="text-[15px] font-semibold text-text-primary line-clamp-2">{notice.bid_ntce_nm}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <BidTypeBadge type={notice.bid_type} />
                  <ScoreBadge score={notice.best_score} grade={notice.best_grade} />
                  {notice.ntce_instt_nm && <span className="text-xs text-text-secondary">{notice.ntce_instt_nm}</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-text-tertiary">
                  {notice.presmpt_prce !== null && <span>추정가격: <span className="font-medium text-text-secondary">{formatPrice(notice.presmpt_prce)}</span></span>}
                  {notice.bid_clse_dt && <span>마감: <span className="font-medium text-text-secondary">{formatKst(notice.bid_clse_dt)}</span></span>}
                  {notice.bid_ntce_dt && <span>공고일: <span className="font-medium text-text-secondary">{formatKst(notice.bid_ntce_dt)}</span></span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border-primary px-6 py-4">
            <p className="text-sm text-text-tertiary">{page} / {totalPages} 페이지</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex h-9 items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-40">이전</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => Math.max(1, Math.min(page - 2, totalPages - 4)) + i).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium ${p === page ? "bg-brand text-white" : "text-text-secondary hover:bg-surface-secondary"}`}>{p}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex h-9 items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedNotice(null); }}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-surface-elevated shadow-xl">
            <div className="flex items-start justify-between border-b border-border-primary p-6">
              <div className="min-w-0 flex-1 pr-4">
                <div className="mb-2 flex flex-wrap gap-2">
                  <BidTypeBadge type={selectedNotice.bid_type} />
                  <ScoreBadge score={selectedNotice.best_score} grade={selectedNotice.best_grade} />
                </div>
                <h2 className="text-[17px] font-semibold text-text-primary leading-snug">{selectedNotice.bid_ntce_nm}</h2>
                <div className="mt-1 flex items-center gap-2">
                  {selectedNotice.ntce_instt_nm && <p className="text-sm text-text-tertiary">{selectedNotice.ntce_instt_nm}</p>}
                  {selectedNotice.bid_ntce_url && (
                    <a href={selectedNotice.bid_ntce_url} target="_blank" rel="noopener noreferrer" className="text-text-disabled transition-colors hover:text-brand" title="공고 상세 보기">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
              <CloseBtn onClick={() => setSelectedNotice(null)} />
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <dl className="space-y-3 text-sm">
                {selectedNotice.match_reasons && selectedNotice.match_reasons.length > 0 && (
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">매칭 시그널</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {selectedNotice.match_reasons.map((r, i) => <span key={i} className="inline-flex items-center rounded-sm bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">{r}</span>)}
                    </dd>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">공고번호</dt><dd className="mt-1 font-medium text-text-primary">{selectedNotice.bid_ntce_no}-{selectedNotice.bid_ntce_ord}</dd></div>
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">공고 종류</dt><dd className="mt-1 text-text-primary">{selectedNotice.ntce_kind_nm ?? "—"}</dd></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">공고기관</dt><dd className="mt-1 text-text-primary">{selectedNotice.ntce_instt_nm ?? "—"}</dd></div>
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">수요기관</dt><dd className="mt-1 text-text-primary">{selectedNotice.dminstt_nm ?? "—"}</dd></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">추정가격</dt><dd className="mt-1 font-semibold text-text-primary">{formatPrice(selectedNotice.presmpt_prce)}</dd></div>
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">배정예산</dt><dd className="mt-1 font-semibold text-text-primary">{formatPrice(selectedNotice.asign_bdgt_amt)}</dd></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">공고일시</dt><dd className="mt-1 text-text-primary">{formatKst(selectedNotice.bid_ntce_dt)}</dd></div>
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">마감일시</dt><dd className="mt-1 text-text-primary">{formatKst(selectedNotice.bid_clse_dt)}</dd></div>
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">개찰일시</dt><dd className="mt-1 text-text-primary">{formatKst(selectedNotice.openg_dt)}</dd></div>
                </div>
                {selectedNotice.cntrct_cncls_mthd_nm && (
                  <div className="rounded-md bg-surface-primary p-3"><dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">계약 체결 방법</dt><dd className="mt-1 text-text-primary">{selectedNotice.cntrct_cncls_mthd_nm}</dd></div>
                )}
                <div className="rounded-md bg-surface-primary p-3">
                  <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">동일 수요기관 과거 공고 (유사도순 최대 10건)</dt>
                  <dd className="mt-2">
                    {pastLoading ? <p className="text-xs text-text-tertiary">조회 중...</p>
                      : pastNotices.length === 0 ? <p className="text-xs text-text-tertiary">동일 수요기관의 과거 공고가 없습니다.</p>
                      : (
                        <ul className="space-y-2">
                          {pastNotices.map((p) => (
                            <li key={p.id} className="rounded-md border border-border-secondary bg-surface-elevated px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-text-primary line-clamp-2">{p.bid_ntce_nm}</p>
                                  <p className="mt-1 text-[11px] text-text-tertiary">
                                    {p.bid_ntce_dt ? formatKst(p.bid_ntce_dt) : "공고일 미상"}
                                    {p.presmpt_prce != null && ` · ${formatPrice(p.presmpt_prce)}`}
                                    {p.similarity_score != null && ` · 유사도 ${p.similarity_score}`}
                                  </p>
                                </div>
                                {(p.bid_ntce_url || p.bid_ntce_dtl_url) && (
                                  <a href={p.bid_ntce_url || p.bid_ntce_dtl_url || "#"} target="_blank" rel="noopener noreferrer"
                                    className="shrink-0 rounded-md bg-surface-secondary px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-tertiary">링크</a>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className="flex h-[82vh] w-full max-w-3xl flex-col rounded-xl bg-surface-elevated shadow-xl">
            {/* Modal header with tabs */}
            <div className="flex items-center justify-between border-b border-border-primary px-6 pt-4">
              <div className="flex gap-1">
                {(["settings", "keywords"] as const).map((tab) => (
                  <button key={tab}
                    onClick={() => tab === "keywords" ? openKeywordsTab() : setSettingsTab("settings")}
                    className={`px-4 pb-3 text-sm font-medium border-b-2 transition-colors ${settingsTab === tab ? "border-brand text-brand" : "border-transparent text-text-secondary hover:text-text-primary"}`}>
                    {tab === "settings" ? "설정" : "키워드 관리"}
                  </button>
                ))}
              </div>
              <CloseBtn onClick={() => setSettingsOpen(false)} />
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Settings tab */}
              {settingsTab === "settings" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-text-primary">Discord 웹훅</h3>
                    <form onSubmit={handleSaveWebhook} className="space-y-2">
                      <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand" />
                      <div className="flex items-center gap-3">
                        <button type="submit" disabled={savingWebhook} className="h-9 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">{savingWebhook ? "저장 중..." : "저장"}</button>
                        {webhookMsg && <p className={`text-sm ${webhookMsg.ok ? "text-positive" : "text-negative"}`}>{webhookMsg.text}</p>}
                      </div>
                    </form>
                  </div>

                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-text-primary">공고 수집</h3>
                    <p className="mb-3 text-xs text-text-tertiary">지정한 시간 범위의 공고를 즉시 수집합니다. (최대 7일)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {([1, 3, 6, 12, 24, 72, 168] as const).map((h) => {
                        const label = h === 72 ? "3일" : h === 168 ? "7일" : `${h}시간`;
                        return (
                          <button key={h} onClick={() => handleBackfill(h)} disabled={backfilling}
                            className="h-9 rounded-md bg-surface-secondary px-3 text-sm font-medium text-text-secondary hover:bg-surface-tertiary disabled:opacity-50">
                            {label}
                          </button>
                        );
                      })}
                      <span className="mx-1 text-border-primary">|</span>
                      <input type="number" value={backfillHours} onChange={(e) => setBackfillHours(e.target.value)} min={1} max={168}
                        className="h-9 w-20 rounded-md bg-surface-secondary px-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand" />
                      <span className="text-sm text-text-tertiary">시간</span>
                      <button onClick={() => handleBackfill(Number(backfillHours))} disabled={backfilling || !backfillHours}
                        className="h-9 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">{backfilling ? "실행 중..." : "수집"}</button>
                    </div>
                    {backfillMsg && <p className={`mt-2 text-sm ${backfillMsg.ok ? "text-positive" : "text-negative"}`}>{backfillMsg.text}</p>}
                  </div>

                  {config && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-text-primary">공공데이터 API 키</h3>
                      {config.data_go_kr_api_key_set ? (
                        <span className="inline-flex items-center gap-1.5 rounded-sm bg-positive-bg px-2.5 py-1 text-sm font-medium text-positive"><span className="h-1.5 w-1.5 rounded-full bg-positive" /> 설정됨</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-sm bg-negative-bg px-2.5 py-1 text-sm font-medium text-negative"><span className="h-1.5 w-1.5 rounded-full bg-negative" /> 미설정</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Keywords tab */}
              {settingsTab === "keywords" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-text-tertiary">모니터링에 사용할 키워드를 관리합니다.</p>
                    <button onClick={() => { setShowAddKw(true); setAddKwForm({ keyword: "", bid_types: [], is_active: true }); setAddKwError(null); }}
                      className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark">+ 키워드 추가</button>
                  </div>
                  {kwLoading ? (
                    <div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>
                  ) : keywords.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-text-tertiary">등록된 키워드가 없습니다.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border-secondary">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border-secondary bg-surface-primary">
                          <th className="px-4 py-3 text-left text-[12px] font-medium uppercase text-text-tertiary">키워드</th>
                          <th className="px-4 py-3 text-left text-[12px] font-medium uppercase text-text-tertiary">유형</th>
                          <th className="px-4 py-3 text-left text-[12px] font-medium uppercase text-text-tertiary">필터</th>
                          <th className="px-4 py-3 text-left text-[12px] font-medium uppercase text-text-tertiary">활성</th>
                          <th className="px-4 py-3 text-left text-[12px] font-medium uppercase text-text-tertiary">작업</th>
                        </tr></thead>
                        <tbody className="divide-y divide-border-secondary">
                          {keywords.map((kw) => (
                            <tr key={kw.id} className="hover:bg-surface-secondary">
                              <td className="px-4 py-3 font-semibold text-text-primary">{kw.keyword}</td>
                              <td className="px-4 py-3">
                                {kw.bid_types.length === 0 ? <span className="text-xs text-text-disabled">전체</span>
                                  : <div className="flex gap-1">{kw.bid_types.map((t) => { const o = BID_TYPE_OPTIONS.find((x) => x.value === t); return o ? <span key={t} className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${o.bg} ${o.text}`}>{o.label}</span> : null; })}</div>}
                              </td>
                              <td className="px-4 py-3">
                                {hasFilter(kw.filter_conditions)
                                  ? <span className="rounded-sm bg-positive-bg px-2 py-0.5 text-xs font-medium text-positive">설정됨</span>
                                  : <span className="rounded-sm bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-disabled">미설정</span>}
                              </td>
                              <td className="px-4 py-3">
                                <button type="button" onClick={() => handleToggleKeyword(kw)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${kw.is_active ? "bg-brand" : "bg-surface-tertiary"}`}>
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${kw.is_active ? "translate-x-6" : "translate-x-1"}`} />
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <button onClick={() => openFilterModal(kw)} className="text-sm font-medium text-brand opacity-80 hover:opacity-100">설정</button>
                                  <button onClick={() => handleDeleteKeyword(kw.id)} className="text-sm font-medium text-negative opacity-70 hover:opacity-100">삭제</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Keyword sub-modal (z-[60]) */}
      {showAddKw && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface-elevated p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-text-primary">키워드 추가</h2>
              <CloseBtn onClick={() => setShowAddKw(false)} />
            </div>
            <form onSubmit={handleAddKeyword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">키워드 <span className="text-negative">*</span></label>
                <input type="text" value={addKwForm.keyword} onChange={(e) => setAddKwForm({ ...addKwForm, keyword: e.target.value })}
                  placeholder="예: 소프트웨어 개발"
                  className="w-full rounded-md bg-surface-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">입찰 유형</label>
                <div className="flex gap-3">
                  {BID_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={addKwForm.bid_types.includes(opt.value)}
                        onChange={() => setAddKwForm((f) => ({ ...f, bid_types: f.bid_types.includes(opt.value) ? f.bid_types.filter((t) => t !== opt.value) : [...f.bid_types, opt.value] }))}
                        className="h-4 w-4 rounded border-border-primary text-brand focus:ring-brand" />
                      <span className="text-sm text-text-secondary">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[12px] text-text-disabled">미선택 시 모든 유형 포함</p>
              </div>
              {addKwError && <div className="rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">{addKwError}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAddKw(false)} className="h-10 rounded-md px-4 text-sm font-medium text-text-secondary hover:bg-surface-secondary">취소</button>
                <button type="submit" disabled={addKwSubmitting} className="h-10 rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">{addKwSubmitting ? "추가 중..." : "추가"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter Settings sub-modal (z-[60]) */}
      {filterTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-surface-elevated shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border-secondary px-6 py-5">
              <div>
                <h2 className="text-[18px] font-semibold text-text-primary">필터 설정</h2>
                <p className="mt-0.5 text-sm text-text-tertiary"><span className="font-medium text-text-secondary">{filterTarget.keyword}</span> 키워드</p>
              </div>
              <CloseBtn onClick={() => setFilterTarget(null)} />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6">
                {[
                  { field: "title_keywords" as TagField, label: "공고명 키워드", placeholder: "예: 데이터, 빅데이터, AI" },
                  { field: "title_exclude" as TagField, label: "제외 키워드", placeholder: "예: 엑스선, 배수로" },
                  { field: "search_aliases" as TagField, label: "검색 유의어", placeholder: "예: 오픈데이터, DB구축" },
                  { field: "institutions" as TagField, label: "기관 필터", placeholder: "예: 조달청, 경상남도" },
                  { field: "lrg_clsfc" as TagField, label: "대분류", placeholder: "예: ICT 서비스", suggestions: LRG_CLSFC_SUGGESTIONS },
                  { field: "clsfc" as TagField, label: "분류명", placeholder: "예: 데이터서비스", suggestions: CLSFC_SUGGESTIONS },
                  { field: "mid_clsfc" as TagField, label: "중분류", placeholder: "예: DB구축 및 자료입력", suggestions: MID_CLSFC_SUGGESTIONS },
                  { field: "success_bid_method" as TagField, label: "낙찰방법", placeholder: "예: 협상에의한계약", suggestions: SUCCESS_BID_SUGGESTIONS },
                  { field: "bid_method" as TagField, label: "입찰방법", placeholder: "예: 전자입찰", suggestions: BID_METHOD_SUGGESTIONS },
                  { field: "region" as TagField, label: "지역", placeholder: "예: 서울특별시", suggestions: REGION_SUGGESTIONS },
                  { field: "rgst_type" as TagField, label: "등록유형", placeholder: "예: 조달청 또는 나라장터 자체 공고건", suggestions: RGST_TYPE_SUGGESTIONS },
                ].map(({ field, label, placeholder, suggestions }) => (
                  <div key={field}>
                    <h3 className="mb-2 text-[13px] font-semibold text-text-primary">{label}</h3>
                    <TagInput tags={filterForm[field]} onAdd={(t) => addTag(field, t)} onRemove={(t) => removeTag(field, t)} placeholder={placeholder} suggestions={suggestions} />
                  </div>
                ))}

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-text-primary">금액 범위</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(["price_min", "price_max"] as const).map((f) => (
                      <div key={f}>
                        <label className="mb-1 block text-[12px] text-text-tertiary">{f === "price_min" ? "최소" : "최대"}</label>
                        <input type="text" inputMode="numeric" value={filterForm[f]}
                          onChange={(e) => setFilterForm((ff) => ({ ...ff, [f]: formatPriceInput(e.target.value) }))}
                          placeholder={f === "price_min" ? "0" : "제한 없음"}
                          className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand" />
                        {filterForm[f] && <p className="mt-1 text-[11px] text-text-tertiary">{priceHint(filterForm[f])}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-text-primary">시그널 가중치</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: "w_title_keyword" as const, label: "제목 키워드" },
                      { key: "w_title_alias" as const, label: "제목 유의어" },
                      { key: "w_category_exact" as const, label: "분류 (정확)" },
                      { key: "w_category_mid" as const, label: "분류 (중분류)" },
                      { key: "w_category_large" as const, label: "분류 (대분류)" },
                      { key: "w_institution" as const, label: "기관 매칭" },
                      { key: "w_flag" as const, label: "플래그" },
                      { key: "w_price_in" as const, label: "가격 범위 내" },
                      { key: "w_price_out" as const, label: "가격 범위 밖" },
                    ]).map((w) => (
                      <div key={w.key}>
                        <label className="mb-1 block text-[11px] text-text-tertiary">{w.label}</label>
                        <input type="number" value={filterForm[w.key]} onChange={(e) => setFilterForm((f) => ({ ...f, [w.key]: e.target.value }))}
                          className="w-full rounded-md bg-surface-secondary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand" />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-text-primary">등급 임계값</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {([{ key: "th_high" as const, label: "High", cls: "text-red-600" }, { key: "th_medium" as const, label: "Medium", cls: "text-amber-600" }, { key: "th_low" as const, label: "Low", cls: "text-slate-600" }]).map((t) => (
                      <div key={t.key}>
                        <label className={`mb-1 block text-[12px] ${t.cls}`}>{t.label}</label>
                        <input type="number" value={filterForm[t.key]} onChange={(e) => setFilterForm((f) => ({ ...f, [t.key]: e.target.value }))}
                          className="w-full rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-border-secondary px-6 py-4">
              {filterError && <div className="mb-3 rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">{filterError}</div>}
              <div className="flex items-center justify-between">
                <button onClick={handleClearFilter} disabled={filterSubmitting} className="h-9 rounded-md px-4 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-50">초기화</button>
                <div className="flex gap-2">
                  <button onClick={() => setFilterTarget(null)} disabled={filterSubmitting} className="h-9 rounded-md px-4 text-sm font-medium text-text-secondary hover:bg-surface-secondary disabled:opacity-50">취소</button>
                  <button onClick={handleSaveFilter} disabled={filterSubmitting} className="h-9 rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">{filterSubmitting ? "저장 중..." : "저장"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BidMonitorPage() {
  return (
    <Suspense fallback={null}>
      <BidMonitorPageContent />
    </Suspense>
  );
}
