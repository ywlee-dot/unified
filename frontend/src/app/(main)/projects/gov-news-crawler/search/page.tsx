"use client";

import { useState, useEffect, useCallback } from "react";
import { GovArticle, GovKeyword } from "@/lib/types";

const API_BASE = "/api";

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="text-xs text-text-disabled">—</span>;
  const cfg =
    score >= 80
      ? "bg-positive-bg text-positive"
      : score >= 60
      ? "bg-warning-bg text-warning"
      : "bg-negative-bg text-negative";
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold ${cfg}`}>
      {score.toFixed(1)}점
    </span>
  );
}

function SourceTypeBadge({ type }: { type: "government" | "news" }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
        type === "government"
          ? "bg-brand-light text-brand"
          : "bg-surface-secondary text-text-secondary"
      }`}
    >
      {type === "government" ? "정부" : "뉴스"}
    </span>
  );
}

export default function GovNewsSearchPage() {
  const [keywords, setKeywords] = useState<GovKeyword[]>([]);
  const [articles, setArticles] = useState<GovArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<GovArticle | null>(null);

  const [filterKeyword, setFilterKeyword] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [sourceType, setSourceType] = useState("all");
  const [sortBy, setSortBy] = useState("score");

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    fetch(`${API_BASE}/projects/gov-news-crawler/keywords`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setKeywords(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => {});
  }, []);

  const fetchArticles = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        page_size: String(pageSize),
        sort: sortBy,
      });
      if (filterKeyword) params.set("keyword_id", filterKeyword);
      if (minScore !== "0") params.set("min_score", minScore);
      if (sourceType !== "all") params.set("source_type", sourceType);

      const res = await fetch(`${API_BASE}/projects/gov-news-crawler/articles?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("기사를 불러오지 못했습니다.");
      const data = await res.json();
      if (Array.isArray(data)) {
        setArticles(data);
        setTotal(data.length);
      } else {
        setArticles(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [filterKeyword, minScore, sourceType, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [filterKeyword, minScore, sourceType, sortBy]);

  useEffect(() => {
    fetchArticles(page);
  }, [fetchArticles, page]);

  function formatDate(dt: string | null) {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("ko-KR");
  }

  const selectClass =
    "h-9 rounded-md bg-surface-secondary px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold leading-tight text-text-primary">기사 검색</h1>
        <p className="mt-1 text-sm text-text-tertiary">수집된 정부 발표 및 뉴스 기사를 검색합니다.</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-surface-elevated p-4 shadow-md">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-text-tertiary">키워드</label>
            <select value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)} className={selectClass}>
              <option value="">전체</option>
              {keywords.map((kw) => (
                <option key={kw.id} value={kw.id}>{kw.query}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-text-tertiary">최소 점수</label>
            <select value={minScore} onChange={(e) => setMinScore(e.target.value)} className={selectClass}>
              <option value="0">전체</option>
              <option value="40">40점 이상</option>
              <option value="60">60점 이상</option>
              <option value="80">80점 이상</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-text-tertiary">소스 유형</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={selectClass}>
              <option value="all">전체</option>
              <option value="government">정부</option>
              <option value="news">뉴스</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-text-tertiary">정렬 기준</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectClass}>
              <option value="score">점수순</option>
              <option value="date">날짜순</option>
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
        ) : articles.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-text-tertiary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10 opacity-40" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-sm">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-secondary">
            {articles.map((article) => (
              <div
                key={article.id}
                className="cursor-pointer px-6 py-4 transition-colors hover:bg-surface-secondary"
                onClick={() => setSelectedArticle(article)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold text-text-primary transition-colors hover:text-brand">
                      {article.title}
                    </h3>
                    {article.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{article.summary}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SourceTypeBadge type={article.source_type} />
                      {article.source_name && (
                        <span className="text-xs text-text-tertiary">{article.source_name}</span>
                      )}
                      {article.institution_name && (
                        <span className="text-xs text-text-disabled">| {article.institution_name}</span>
                      )}
                      {article.author && (
                        <span className="text-xs text-text-disabled">| {article.author}</span>
                      )}
                      <span className="text-xs text-text-disabled">| {formatDate(article.published_at)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <ScoreBadge score={article.final_score} />
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
              {/* Page number buttons — show up to 5 around current */}
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

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedArticle(null); }}
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-surface-elevated shadow-xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border-primary p-6">
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold text-text-primary">{selectedArticle.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SourceTypeBadge type={selectedArticle.source_type} />
                  {selectedArticle.source_name && (
                    <span className="text-xs text-text-tertiary">{selectedArticle.source_name}</span>
                  )}
                  {selectedArticle.institution_name && (
                    <span className="text-xs text-text-disabled">| {selectedArticle.institution_name}</span>
                  )}
                  <span className="text-xs text-text-disabled">| {formatDate(selectedArticle.published_at)}</span>
                </div>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-3">
                <ScoreBadge score={selectedArticle.final_score} />
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-secondary"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {selectedArticle.summary && (
                <div>
                  <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">요약</h3>
                  <p className="rounded-md bg-surface-primary p-3 text-sm leading-relaxed text-text-secondary">
                    {selectedArticle.summary}
                  </p>
                </div>
              )}
              <div>
                <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">본문</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {selectedArticle.content}
                </p>
              </div>
              <div>
                <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">원문 링크</h3>
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-brand hover:underline"
                >
                  {selectedArticle.url}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
