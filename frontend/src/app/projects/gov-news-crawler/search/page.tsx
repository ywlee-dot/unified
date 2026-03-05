"use client";

import { useState, useEffect, useCallback } from "react";
import { GovArticle, GovKeyword } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400 text-xs">—</span>;
  const cfg =
    score >= 80
      ? "bg-green-100 text-green-700"
      : score >= 60
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg}`}>
      {score.toFixed(1)}점
    </span>
  );
}

function SourceTypeBadge({ type }: { type: "government" | "news" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        type === "government" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
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
    fetch(`${API_BASE}/projects/gov-news-crawler/keywords`)
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

      const res = await fetch(`${API_BASE}/projects/gov-news-crawler/articles?${params}`);
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">기사 검색</h1>
        <p className="mt-1 text-sm text-slate-500">수집된 정부 발표 및 뉴스 기사를 검색합니다.</p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">키워드</label>
            <select
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체</option>
              {keywords.map((kw) => (
                <option key={kw.id} value={kw.id}>
                  {kw.query}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">최소 점수</label>
            <select
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="0">전체</option>
              <option value="40">40점 이상</option>
              <option value="60">60점 이상</option>
              <option value="80">80점 이상</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">소스 유형</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="government">정부</option>
              <option value="news">뉴스</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">정렬 기준</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="score">점수순</option>
              <option value="date">날짜순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            검색 결과 {total > 0 && <span className="ml-1 text-slate-500">({total.toLocaleString()}건)</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : articles.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-slate-500">
            검색 결과가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {articles.map((article) => (
              <div
                key={article.id}
                className="cursor-pointer px-6 py-4 hover:bg-slate-50"
                onClick={() => setSelectedArticle(article)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-blue-700 hover:underline">
                      {article.title}
                    </h3>
                    {article.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{article.summary}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <SourceTypeBadge type={article.source_type} />
                      {article.source_name && <span>{article.source_name}</span>}
                      {article.institution_name && (
                        <span className="text-slate-400">| {article.institution_name}</span>
                      )}
                      {article.author && <span>| {article.author}</span>}
                      <span>| {formatDate(article.published_at)}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ScoreBadge score={article.final_score} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
            <p className="text-sm text-slate-500">
              {page} / {totalPages} 페이지
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                이전
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-6">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900">{selectedArticle.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <SourceTypeBadge type={selectedArticle.source_type} />
                  {selectedArticle.source_name && <span>{selectedArticle.source_name}</span>}
                  {selectedArticle.institution_name && (
                    <span>| {selectedArticle.institution_name}</span>
                  )}
                  <span>| {formatDate(selectedArticle.published_at)}</span>
                </div>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-3">
                <ScoreBadge score={selectedArticle.final_score} />
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedArticle.summary && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-700">요약</h3>
                  <p className="text-sm text-slate-600">{selectedArticle.summary}</p>
                </div>
              )}
              <div>
                <h3 className="mb-1 text-sm font-semibold text-slate-700">본문</h3>
                <p className="whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">
                  {selectedArticle.content}
                </p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-slate-700">원문 링크</h3>
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
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
