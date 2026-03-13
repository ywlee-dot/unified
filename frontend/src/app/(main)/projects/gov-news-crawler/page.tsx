"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GovNewsStats, GovCrawlRun, GovKeyword } from "@/lib/types";

const API_BASE = "/api";

function StatusBadge({ status }: { status: GovCrawlRun["status"] }) {
  const config: Record<GovCrawlRun["status"], { bg: string; text: string; dot: string }> = {
    pending: { bg: "bg-surface-secondary", text: "text-text-secondary", dot: "bg-text-tertiary" },
    running: { bg: "bg-brand-light", text: "text-brand", dot: "bg-brand" },
    completed: { bg: "bg-positive-bg", text: "text-positive", dot: "bg-positive" },
    failed: { bg: "bg-negative-bg", text: "text-negative", dot: "bg-negative" },
  };
  const labels: Record<GovCrawlRun["status"], string> = {
    pending: "대기중",
    running: "실행중",
    completed: "완료",
    failed: "실패",
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {labels[status]}
    </span>
  );
}

const STAT_CARDS = [
  {
    key: "total_keywords" as const,
    label: "전체 키워드",
    iconBg: "bg-brand-light",
    iconColor: "text-brand",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "active_keywords" as const,
    label: "활성 키워드",
    iconBg: "bg-positive-bg",
    iconColor: "text-positive",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "total_sources" as const,
    label: "수집 소스",
    iconBg: "bg-warning-bg",
    iconColor: "text-warning",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    key: "total_articles" as const,
    label: "전체 기사",
    iconBg: "bg-surface-tertiary",
    iconColor: "text-text-secondary",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function GovNewsCrawlerPage() {
  const [stats, setStats] = useState<GovNewsStats | null>(null);
  const [keywords, setKeywords] = useState<GovKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedKeywordId, setSelectedKeywordId] = useState<string>("");
  const [useAI, setUseAI] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, kwRes] = await Promise.all([
          fetch(`${API_BASE}/projects/gov-news-crawler/stats`, { credentials: "include" }),
          fetch(`${API_BASE}/projects/gov-news-crawler/keywords`, { credentials: "include" }),
        ]);
        if (!statsRes.ok) throw new Error("통계 데이터를 불러오지 못했습니다.");
        const statsData = await statsRes.json();
        setStats(statsData);

        if (kwRes.ok) {
          const kwData = await kwRes.json();
          setKeywords(Array.isArray(kwData) ? kwData : kwData.items ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleTrigger() {
    setTriggering(true);
    setTriggerMessage(null);
    try {
      const body: Record<string, unknown> = { enable_ai: useAI };
      if (selectedKeywordId) body.keyword_id = selectedKeywordId;
      const res = await fetch(`${API_BASE}/projects/gov-news-crawler/crawl/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) throw new Error("크롤링 실행에 실패했습니다.");
      const data = await res.json();
      setTriggerMessage({
        text: `크롤링이 시작되었습니다. (실행 ID: ${data.id ?? data.run_id ?? "—"})`,
        ok: true,
      });
    } catch (e) {
      setTriggerMessage({
        text: e instanceof Error ? e.message : "오류가 발생했습니다.",
        ok: false,
      });
    } finally {
      setTriggering(false);
    }
  }

  function formatDate(dt: string | null) {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("ko-KR");
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
          <h1 className="text-[22px] font-bold leading-tight text-text-primary">정부 뉴스 크롤링</h1>
          <p className="mt-1 text-sm text-text-tertiary">정부 발표 및 뉴스 기사를 수집·분석합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/projects/gov-news-crawler/keywords"
            className="inline-flex h-9 items-center rounded-md bg-surface-secondary px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
          >
            키워드 관리
          </Link>
          <Link
            href="/projects/gov-news-crawler/search"
            className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            기사 검색
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STAT_CARDS.map((card) => (
            <div key={card.key} className="rounded-lg bg-surface-elevated p-5 shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-text-tertiary">{card.label}</p>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${card.iconBg} ${card.iconColor}`}>
                  {card.icon}
                </span>
              </div>
              <p className="mt-3 text-[24px] font-bold leading-none text-text-primary">
                {stats[card.key].toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Crawl Trigger */}
      <div className="rounded-lg bg-surface-elevated p-6 shadow-md">
        <h2 className="mb-4 text-[17px] font-semibold text-text-primary">크롤링 실행</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-text-secondary">키워드 선택 (선택 사항)</label>
            <select
              value={selectedKeywordId}
              onChange={(e) => setSelectedKeywordId(e.target.value)}
              className="h-10 rounded-md bg-surface-secondary px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">전체 키워드</option>
              {keywords.map((kw) => (
                <option key={kw.id} value={kw.id}>
                  {kw.query}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 pb-0.5">
            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={useAI}
              onClick={() => setUseAI((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 ${
                useAI ? "bg-brand" : "bg-surface-tertiary"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  useAI ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm font-medium text-text-secondary">AI 분석 사용</span>
          </label>

          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="h-10 rounded-md bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            {triggering ? "실행 중..." : "크롤링 시작"}
          </button>
        </div>

        {triggerMessage && (
          <p className={`mt-3 text-sm font-medium ${triggerMessage.ok ? "text-positive" : "text-negative"}`}>
            {triggerMessage.text}
          </p>
        )}
      </div>

      {/* Recent Crawl Runs */}
      {stats && stats.recent_crawl_runs.length > 0 && (
        <div className="rounded-lg bg-surface-elevated shadow-md">
          <div className="border-b border-border-primary px-6 py-4">
            <h2 className="text-[17px] font-semibold text-text-primary">최근 실행 이력</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-secondary bg-surface-primary">
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">상태</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">실행 유형</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">시작 시간</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">완료 시간</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">통계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {stats.recent_crawl_runs.map((run) => (
                  <tr key={run.id} className="transition-colors hover:bg-surface-secondary">
                    <td className="px-6 py-3.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-6 py-3.5 text-text-primary">{run.trigger_type}</td>
                    <td className="px-6 py-3.5 text-text-secondary">{formatDate(run.started_at)}</td>
                    <td className="px-6 py-3.5 text-text-secondary">{formatDate(run.completed_at)}</td>
                    <td className="px-6 py-3.5 text-text-secondary">
                      {Object.keys(run.statistics).length > 0
                        ? Object.entries(run.statistics)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
