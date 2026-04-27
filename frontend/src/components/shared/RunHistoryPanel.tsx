"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clock, History, RefreshCw, Trash2 } from "lucide-react";
import type { ProcessExecutionSummary } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

interface RunHistoryPanelProps {
  projectSlug: string;
  onSelect: (executionId: string) => void | Promise<void>;
  refreshKey?: number;
  filter?: (item: ProcessExecutionSummary) => boolean;
  selectedExecutionId?: string | null;
  pageSize?: number;
  emptyMessage?: string;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function statusStyle(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case "succeeded":
      return { bg: "#E6F9F3", color: "#00B386", label: "완료" };
    case "running":
      return { bg: "#E8F1FF", color: "#0064FF", label: "실행중" };
    case "failed":
      return { bg: "#FFF0F1", color: "#F04452", label: "실패" };
    default:
      return { bg: "#F0F1F4", color: "#4E5968", label: status };
  }
}

export default function RunHistoryPanel({
  projectSlug,
  onSelect,
  refreshKey,
  filter,
  selectedExecutionId,
  pageSize = 20,
  emptyMessage = "이전 실행 기록이 없습니다",
}: RunHistoryPanelProps) {
  const [items, setItems] = useState<ProcessExecutionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_BASE}/projects/${projectSlug}/runs?page=1&page_size=${pageSize}`,
        { credentials: "include" }
      );
      if (!resp.ok) throw new Error(`이력 조회 실패 (${resp.status})`);
      const data = await resp.json();
      const raw: ProcessExecutionSummary[] = data.items ?? data.data?.items ?? [];
      setItems(filter ? raw.filter(filter) : raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이력 조회 중 오류");
    } finally {
      setLoading(false);
    }
  }, [projectSlug, pageSize, filter]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns, refreshKey]);

  const handleDelete = async (executionId: string) => {
    if (!confirm("이 실행 이력을 삭제하시겠습니까?")) return;
    try {
      const resp = await fetch(
        `${API_BASE}/projects/${projectSlug}/runs/${executionId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!resp.ok) throw new Error("삭제 실패");
      await fetchRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const total = items.length;

  return (
    <div
      className="rounded-xl"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 transition-colors"
        style={{ borderBottom: expanded ? "1px solid #F0F1F4" : "none" }}
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" style={{ color: "#4E5968" }} />
          <span className="text-sm font-semibold" style={{ color: "#191F28" }}>
            이전 실행
          </span>
          <span
            className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
          >
            {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                fetchRuns();
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer"
              style={{ color: "#8B95A1", backgroundColor: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F4F5F8")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              새로고침
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4" style={{ color: "#8B95A1" }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: "#8B95A1" }} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="max-h-80 overflow-y-auto">
          {error && (
            <div className="px-4 py-3 text-sm" style={{ color: "#F04452" }}>
              {error}
            </div>
          )}

          {!error && total === 0 && !loading && (
            <div className="px-4 py-8 text-center">
              <Clock className="mx-auto mb-2 h-6 w-6" style={{ color: "#B0B8C1" }} />
              <p className="text-sm" style={{ color: "#8B95A1" }}>
                {emptyMessage}
              </p>
            </div>
          )}

          {!error && loading && items.length === 0 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "#8B95A1" }}>
              불러오는 중...
            </div>
          )}

          <ul className="divide-y" style={{ borderColor: "#F0F1F4" }}>
            {items.map((item) => {
              const stat = statusStyle(item.status);
              const isSelected = item.execution_id === selectedExecutionId;
              return (
                <li
                  key={item.execution_id}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? "#E8F1FF" : "transparent",
                  }}
                  onClick={() => onSelect(item.execution_id)}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "#F8F9FB";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: stat.bg, color: stat.color }}
                  >
                    {stat.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm"
                      style={{ color: "#191F28", fontWeight: isSelected ? 600 : 500 }}
                      title={item.input_summary}
                    >
                      {item.input_summary || `(${item.execution_id.slice(0, 8)})`}
                    </p>
                    {item.error_message && (
                      <p
                        className="truncate text-xs"
                        style={{ color: "#F04452" }}
                        title={item.error_message}
                      >
                        {item.error_message}
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 text-xs whitespace-nowrap"
                    style={{ color: "#8B95A1" }}
                  >
                    {formatRelative(item.started_at)}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.execution_id);
                    }}
                    className="rounded p-1 transition-colors cursor-pointer"
                    style={{ color: "#B0B8C1" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#FFF0F1";
                      e.currentTarget.style.color = "#F04452";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#B0B8C1";
                    }}
                    title="삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
