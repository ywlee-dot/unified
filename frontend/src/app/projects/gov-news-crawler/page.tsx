"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GovNewsStats, GovCrawlRun, GovKeyword } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function StatusBadge({ status }: { status: GovCrawlRun["status"] }) {
  const config = {
    pending: "bg-slate-100 text-slate-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  const labels = {
    pending: "대기중",
    running: "실행중",
    completed: "완료",
    failed: "실패",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function GovNewsCrawlerPage() {
  const [stats, setStats] = useState<GovNewsStats | null>(null);
  const [keywords, setKeywords] = useState<GovKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedKeywordId, setSelectedKeywordId] = useState<string>("");
  const [useAI, setUseAI] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, kwRes] = await Promise.all([
          fetch(`${API_BASE}/projects/gov-news-crawler/stats`),
          fetch(`${API_BASE}/projects/gov-news-crawler/keywords`),
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
      });
      if (!res.ok) throw new Error("크롤링 실행에 실패했습니다.");
      const data = await res.json();
      setTriggerMessage(`크롤링이 시작되었습니다. (실행 ID: ${data.id ?? data.run_id ?? "—"})`);
    } catch (e) {
      setTriggerMessage(e instanceof Error ? e.message : "오류가 발생했습니다.");
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-red-700">
        <p className="font-medium">오류</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">정부 뉴스 크롤링</h1>
          <p className="mt-1 text-sm text-slate-500">정부 발표 및 뉴스 기사를 수집·분석합니다.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/projects/gov-news-crawler/keywords"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            키워드 관리
          </Link>
          <Link
            href="/projects/gov-news-crawler/search"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            기사 검색
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "전체 키워드", value: stats.total_keywords },
            { label: "활성 키워드", value: stats.active_keywords },
            { label: "수집 소스", value: stats.total_sources },
            { label: "전체 기사", value: stats.total_articles },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{card.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Crawl Trigger */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">크롤링 실행</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">키워드 선택 (선택 사항)</label>
            <select
              value={selectedKeywordId}
              onChange={(e) => setSelectedKeywordId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체 키워드</option>
              {keywords.map((kw) => (
                <option key={kw.id} value={kw.id}>
                  {kw.query}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="use-ai"
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <label htmlFor="use-ai" className="text-sm font-medium text-slate-700">
              AI 분석 사용
            </label>
          </div>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {triggering ? "실행 중..." : "크롤링 시작"}
          </button>
        </div>
        {triggerMessage && (
          <p className="mt-3 text-sm text-slate-600">{triggerMessage}</p>
        )}
      </div>

      {/* Recent Crawl Runs */}
      {stats && stats.recent_crawl_runs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-800">최근 실행 이력</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">상태</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">실행 유형</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">시작 시간</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">완료 시간</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">통계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recent_crawl_runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-6 py-3 text-slate-700">{run.trigger_type}</td>
                    <td className="px-6 py-3 text-slate-600">{formatDate(run.started_at)}</td>
                    <td className="px-6 py-3 text-slate-600">{formatDate(run.completed_at)}</td>
                    <td className="px-6 py-3 text-slate-600">
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
