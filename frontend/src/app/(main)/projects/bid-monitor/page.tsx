"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BidMonitorStats, BidCheckRun } from "@/lib/types";

const API_BASE = "/api";

function StatusBadge({ status }: { status: BidCheckRun["status"] }) {
  const config: Record<BidCheckRun["status"], { bg: string; text: string; dot: string }> = {
    running: { bg: "bg-brand-light", text: "text-brand", dot: "bg-brand" },
    completed: { bg: "bg-positive-bg", text: "text-positive", dot: "bg-positive" },
    failed: { bg: "bg-negative-bg", text: "text-negative", dot: "bg-negative" },
  };
  const labels: Record<BidCheckRun["status"], string> = {
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
    key: "total_notices" as const,
    label: "수집된 공고",
    iconBg: "bg-warning-bg",
    iconColor: "text-warning",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "total_alerts" as const,
    label: "전송된 알림",
    iconBg: "bg-surface-tertiary",
    iconColor: "text-text-secondary",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
];

export default function BidMonitorPage() {
  const [stats, setStats] = useState<BidMonitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/projects/bid-monitor/stats`, { credentials: "include" });
        if (!res.ok) throw new Error("통계 데이터를 불러오지 못했습니다.");
        const data = await res.json();
        setStats(data);
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
      const res = await fetch(`${API_BASE}/projects/bid-monitor/check/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("수동 점검 실행에 실패했습니다.");
      const data = await res.json();
      setTriggerMessage({
        text: `점검이 시작되었습니다. (실행 ID: ${data.id ?? data.run_id ?? "—"})`,
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
    const d = new Date(dt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
          <h1 className="text-[22px] font-bold leading-tight text-text-primary">입찰 공고 모니터</h1>
          <p className="mt-1 text-sm text-text-tertiary">나라장터 입찰 공고를 모니터링하고 Discord로 알림을 전송합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/projects/bid-monitor/keywords"
            className="inline-flex h-9 items-center rounded-md bg-surface-secondary px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
          >
            키워드 관리
          </Link>
          <Link
            href="/projects/bid-monitor/notices"
            className="inline-flex h-9 items-center rounded-md bg-surface-secondary px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
          >
            공고 검색
          </Link>
          <Link
            href="/projects/bid-monitor/settings"
            className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            설정
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

      {/* Scheduler Status + Manual Trigger */}
      <div className="rounded-lg bg-surface-elevated p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-text-primary">스케줄러 상태</h2>
            <div className="mt-2 flex items-center gap-2">
              {stats?.scheduler_running ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-positive-bg px-2 py-0.5 text-xs font-medium text-positive">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" />
                  실행중
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
                  중지됨
                </span>
              )}
              <span className="text-sm text-text-tertiary">자동 점검이 주기적으로 실행됩니다.</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleTrigger}
              disabled={triggering}
              className="h-10 rounded-md bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {triggering ? "실행 중..." : "수동 점검 실행"}
            </button>
            {triggerMessage && (
              <p className={`text-sm font-medium ${triggerMessage.ok ? "text-positive" : "text-negative"}`}>
                {triggerMessage.text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Check Runs */}
      {stats && stats.recent_runs.length > 0 && (
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
                {stats.recent_runs.map((run) => (
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

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/projects/bid-monitor/keywords"
          className="group rounded-lg bg-surface-elevated p-5 shadow-md transition-shadow hover:shadow-lg"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-text-primary group-hover:text-brand">키워드 관리</p>
              <p className="text-xs text-text-tertiary">모니터링할 키워드 추가·편집</p>
            </div>
          </div>
        </Link>
        <Link
          href="/projects/bid-monitor/notices"
          className="group rounded-lg bg-surface-elevated p-5 shadow-md transition-shadow hover:shadow-lg"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-bg text-warning">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-text-primary group-hover:text-brand">공고 검색</p>
              <p className="text-xs text-text-tertiary">수집된 입찰 공고 검색·조회</p>
            </div>
          </div>
        </Link>
        <Link
          href="/projects/bid-monitor/settings"
          className="group rounded-lg bg-surface-elevated p-5 shadow-md transition-shadow hover:shadow-lg"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-tertiary text-text-secondary">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-text-primary group-hover:text-brand">설정</p>
              <p className="text-xs text-text-tertiary">Discord 웹훅·API 키 설정</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
