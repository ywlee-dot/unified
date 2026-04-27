"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, History, RefreshCw, Trash2, X } from "lucide-react";
import type { ProcessExecutionSummary } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";
const MODAL_PAGE_SIZE = 10;

interface RunHistoryPanelProps {
  projectSlug: string;
  onSelect: (executionId: string) => void | Promise<void>;
  onClose?: () => void;
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
    case "succeeded": return { bg: "#E6F9F3", color: "#00B386", label: "완료" };
    case "running":   return { bg: "#E8F1FF", color: "#0064FF", label: "실행중" };
    case "failed":    return { bg: "#FFF0F1", color: "#F04452", label: "실패" };
    default:          return { bg: "#F0F1F4", color: "#4E5968", label: status };
  }
}

function ItemList({
  items, loading, error, emptyMessage, selectedExecutionId, onSelect, onDelete,
}: {
  items: ProcessExecutionSummary[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  selectedExecutionId?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (error) return <div className="px-4 py-4 text-sm" style={{ color: "#F04452" }}>{error}</div>;
  if (loading && items.length === 0) return (
    <div className="px-4 py-6 text-center text-sm" style={{ color: "#8B95A1" }}>불러오는 중...</div>
  );
  if (items.length === 0) return (
    <div className="px-4 py-10 text-center">
      <Clock className="mx-auto mb-2 h-6 w-6" style={{ color: "#B0B8C1" }} />
      <p className="text-sm" style={{ color: "#8B95A1" }}>{emptyMessage}</p>
    </div>
  );
  return (
    <ul className="divide-y divide-[#F0F1F4]">
      {items.map((item) => {
        const stat = statusStyle(item.status);
        const isSelected = item.execution_id === selectedExecutionId;
        return (
          <li
            key={item.execution_id}
            className="flex items-center gap-3 px-4 py-4 transition-colors cursor-pointer"
            style={{ backgroundColor: isSelected ? "#E8F1FF" : "transparent" }}
            onClick={() => onSelect(item.execution_id)}
            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#F8F9FB"; }}
            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
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
                <p className="truncate text-xs" style={{ color: "#F04452" }} title={item.error_message}>
                  {item.error_message}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs whitespace-nowrap" style={{ color: "#8B95A1" }}>
              {formatRelative(item.started_at)}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onDelete(item.execution_id); }}
              className="rounded p-1 transition-colors cursor-pointer"
              style={{ color: "#B0B8C1" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FFF0F1"; e.currentTarget.style.color = "#F04452"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#B0B8C1"; }}
              title="삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function RunHistoryPanel({
  projectSlug,
  onSelect,
  onClose,
  refreshKey,
  filter,
  selectedExecutionId,
  pageSize = 20,
  emptyMessage = "히스토리 기록이 없습니다",
}: RunHistoryPanelProps) {
  const isModal = !!onClose;
  const effectivePageSize = isModal ? MODAL_PAGE_SIZE : pageSize;

  const [items, setItems] = useState<ProcessExecutionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchRuns = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_BASE}/projects/${projectSlug}/runs?page=${p}&page_size=${effectivePageSize}`,
        { credentials: "include" }
      );
      if (!resp.ok) throw new Error(`이력 조회 실패 (${resp.status})`);
      const data = await resp.json();
      const raw: ProcessExecutionSummary[] = data.items ?? data.data?.items ?? [];
      setItems(filter ? raw.filter(filter) : raw);
      setTotalPages(data.total_pages ?? 1);
      setTotalCount(data.total ?? raw.length);
      setPage(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이력 조회 중 오류");
    } finally {
      setLoading(false);
    }
  }, [projectSlug, effectivePageSize, filter]);

  useEffect(() => {
    fetchRuns(1);
  }, [fetchRuns, refreshKey]);

  const handleDelete = async (executionId: string) => {
    if (!confirm("이 실행 이력을 삭제하시겠습니까?")) return;
    try {
      const resp = await fetch(
        `${API_BASE}/projects/${projectSlug}/runs/${executionId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!resp.ok) throw new Error("삭제 실패");
      // stay on current page, but go back if page is now empty
      await fetchRuns(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-lg rounded-2xl shadow-xl flex flex-col"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E8EB",
            height: "600px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex shrink-0 items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid #F0F1F4" }}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" style={{ color: "#4E5968" }} />
              <span className="text-sm font-semibold" style={{ color: "#191F28" }}>히스토리</span>
              <span
                className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
              >
                {totalCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRuns(page)}
                className="rounded-md p-1.5 transition-colors"
                style={{ color: "#8B95A1" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F4F5F8")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                title="새로고침"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 transition-colors"
                style={{ color: "#8B95A1" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F4F5F8")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body — fixed height, scrollable */}
          <div className="flex-1 overflow-y-auto">
            <ItemList
              items={items}
              loading={loading}
              error={error}
              emptyMessage={emptyMessage}
              selectedExecutionId={selectedExecutionId}
              onSelect={onSelect}
              onDelete={handleDelete}
            />
          </div>

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div
              className="flex shrink-0 items-center justify-between px-5 py-3"
              style={{ borderTop: "1px solid #F0F1F4" }}
            >
              <button
                onClick={() => fetchRuns(page - 1)}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-colors disabled:opacity-40"
                style={{ color: "#4E5968", backgroundColor: "transparent" }}
                onMouseEnter={(e) => { if (page > 1) e.currentTarget.style.backgroundColor = "#F4F5F8"; }}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                이전
              </button>
              <span className="text-xs" style={{ color: "#8B95A1" }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => fetchRuns(page + 1)}
                disabled={page >= totalPages || loading}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-colors disabled:opacity-40"
                style={{ color: "#4E5968", backgroundColor: "transparent" }}
                onMouseEnter={(e) => { if (page < totalPages) e.currentTarget.style.backgroundColor = "#F4F5F8"; }}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                다음
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Inline collapsible card
  return (
    <div className="rounded-xl" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 transition-colors"
        style={{ borderBottom: expanded ? "1px solid #F0F1F4" : "none" }}
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" style={{ color: "#4E5968" }} />
          <span className="text-sm font-semibold" style={{ color: "#191F28" }}>히스토리</span>
          <span
            className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
          >
            {totalCount}
          </span>
        </div>
        {expanded && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); fetchRuns(1); }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer"
            style={{ color: "#8B95A1" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F4F5F8")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </span>
        )}
      </button>

      {expanded && (
        <div className="max-h-80 overflow-y-auto">
          <ItemList
            items={items}
            loading={loading}
            error={error}
            emptyMessage={emptyMessage}
            selectedExecutionId={selectedExecutionId}
            onSelect={onSelect}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}
