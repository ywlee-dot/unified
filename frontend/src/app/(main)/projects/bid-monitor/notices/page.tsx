"use client";

import { useState, useEffect, useCallback } from "react";
import { BidNotice } from "@/lib/types";

const API_BASE = "/api";

const BID_TYPE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "goods", label: "물품" },
  { value: "services", label: "용역" },
  { value: "construction", label: "공사" },
];

const SORT_OPTIONS = [
  { value: "date", label: "최신순" },
  { value: "price", label: "가격순" },
  { value: "deadline", label: "마감순" },
];

function BidTypeBadge({ type }: { type: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    goods: { bg: "bg-blue-50", text: "text-blue-600", label: "물품" },
    services: { bg: "bg-purple-50", text: "text-purple-600", label: "용역" },
    construction: { bg: "bg-amber-50", text: "text-amber-600", label: "공사" },
  };
  const cfg = map[type] ?? { bg: "bg-surface-secondary", text: "text-text-secondary", label: type };
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function formatPrice(amount: number | null): string {
  if (amount === null) return "—";
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000);
    const man = Math.floor((amount % 100_000_000) / 10_000);
    return man > 0 ? `${eok.toLocaleString()}억 ${man.toLocaleString()}만원` : `${eok.toLocaleString()}억원`;
  }
  if (amount >= 10_000) {
    return `${Math.floor(amount / 10_000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

function formatDate(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function BidNoticesPage() {
  const [notices, setNotices] = useState<BidNotice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<BidNotice | null>(null);

  const [keyword, setKeyword] = useState("");
  const [bidType, setBidType] = useState("");
  const [sort, setSort] = useState("date");

  const pageSize = 20;

  const fetchNotices = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        page_size: String(pageSize),
        sort,
      });
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (bidType) params.set("bid_type", bidType);

      const res = await fetch(`${API_BASE}/projects/bid-monitor/notices?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("공고를 불러오지 못했습니다.");
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotices(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        setNotices(data.items ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.total_pages ?? 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [keyword, bidType, sort]);

  useEffect(() => {
    setPage(1);
  }, [keyword, bidType, sort]);

  useEffect(() => {
    fetchNotices(page);
  }, [fetchNotices, page]);

  const selectClass =
    "h-9 rounded-md bg-surface-secondary px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold leading-tight text-text-primary">공고 검색</h1>
        <p className="mt-1 text-sm text-text-tertiary">수집된 나라장터 입찰 공고를 검색하고 조회합니다.</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-surface-elevated p-4 shadow-md">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
            <label className="text-[12px] font-medium text-text-tertiary">공고명 검색</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="키워드 입력..."
              className="h-9 rounded-md bg-surface-secondary px-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-text-tertiary">입찰 유형</label>
            <select value={bidType} onChange={(e) => setBidType(e.target.value)} className={selectClass}>
              {BID_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-text-tertiary">정렬</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-lg bg-surface-elevated shadow-md">
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
          <h2 className="text-[15px] font-semibold text-text-primary">
            검색 결과
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-text-tertiary">{total.toLocaleString()}건</span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-negative">{error}</p>
          </div>
        ) : notices.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-text-tertiary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10 opacity-40" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-sm">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-secondary">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="cursor-pointer px-6 py-4 transition-colors hover:bg-surface-secondary"
                onClick={() => setSelectedNotice(notice)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold text-text-primary transition-colors hover:text-brand line-clamp-2">
                      {notice.bid_ntce_nm}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <BidTypeBadge type={notice.bid_type} />
                      {notice.ntce_instt_nm && (
                        <span className="text-xs text-text-secondary">{notice.ntce_instt_nm}</span>
                      )}
                      {notice.ntce_kind_nm && (
                        <span className="text-xs text-text-disabled">| {notice.ntce_kind_nm}</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-text-tertiary">
                      {notice.presmpt_prce !== null && (
                        <span>추정가격: <span className="font-medium text-text-secondary">{formatPrice(notice.presmpt_prce)}</span></span>
                      )}
                      {notice.bid_clse_dt && (
                        <span>마감: <span className="font-medium text-text-secondary">{formatDate(notice.bid_clse_dt)}</span></span>
                      )}
                      {notice.bid_ntce_dt && (
                        <span>공고일: <span className="font-medium text-text-secondary">{formatDate(notice.bid_ntce_dt)}</span></span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-text-disabled">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border-primary px-6 py-4">
            <p className="text-sm text-text-tertiary">
              {page} / {totalPages} 페이지
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-9 items-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-secondary disabled:opacity-40"
              >
                이전
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                return start + i;
              }).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-brand text-white"
                      : "text-text-secondary hover:bg-surface-secondary"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-9 items-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-secondary disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedNotice(null); }}
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-surface-elevated shadow-xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border-primary p-6">
              <div className="min-w-0 flex-1 pr-4">
                <div className="mb-2">
                  <BidTypeBadge type={selectedNotice.bid_type} />
                </div>
                <h2 className="text-[17px] font-semibold text-text-primary leading-snug">{selectedNotice.bid_ntce_nm}</h2>
                {selectedNotice.ntce_instt_nm && (
                  <p className="mt-1 text-sm text-text-tertiary">{selectedNotice.ntce_instt_nm}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-secondary"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <dl className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">공고번호</dt>
                    <dd className="mt-1 font-medium text-text-primary">{selectedNotice.bid_ntce_no}-{selectedNotice.bid_ntce_ord}</dd>
                  </div>
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">공고 종류</dt>
                    <dd className="mt-1 text-text-primary">{selectedNotice.ntce_kind_nm ?? "—"}</dd>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">공고기관</dt>
                    <dd className="mt-1 text-text-primary">{selectedNotice.ntce_instt_nm ?? "—"}</dd>
                  </div>
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">수요기관</dt>
                    <dd className="mt-1 text-text-primary">{selectedNotice.dminstt_nm ?? "—"}</dd>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">추정가격</dt>
                    <dd className="mt-1 font-semibold text-text-primary">{formatPrice(selectedNotice.presmpt_prce)}</dd>
                  </div>
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">배정예산</dt>
                    <dd className="mt-1 font-semibold text-text-primary">{formatPrice(selectedNotice.asign_bdgt_amt)}</dd>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">공고일시</dt>
                    <dd className="mt-1 text-text-primary">{formatDate(selectedNotice.bid_ntce_dt)}</dd>
                  </div>
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">마감일시</dt>
                    <dd className="mt-1 text-text-primary">{formatDate(selectedNotice.bid_clse_dt)}</dd>
                  </div>
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">개찰일시</dt>
                    <dd className="mt-1 text-text-primary">{formatDate(selectedNotice.openg_dt)}</dd>
                  </div>
                </div>
                {selectedNotice.cntrct_cncls_mthd_nm && (
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">계약 체결 방법</dt>
                    <dd className="mt-1 text-text-primary">{selectedNotice.cntrct_cncls_mthd_nm}</dd>
                  </div>
                )}
                {(selectedNotice.bid_ntce_url || selectedNotice.bid_ntce_dtl_url) && (
                  <div className="rounded-md bg-surface-primary p-3">
                    <dt className="text-[12px] font-medium uppercase tracking-wide text-text-tertiary">나라장터 링크</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                      {selectedNotice.bid_ntce_url && (
                        <a
                          href={selectedNotice.bid_ntce_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark"
                        >
                          공고 상세 보기
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                          </svg>
                        </a>
                      )}
                      {selectedNotice.bid_ntce_dtl_url && (
                        <a
                          href={selectedNotice.bid_ntce_dtl_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
                        >
                          입찰 상세 보기
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                          </svg>
                        </a>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
