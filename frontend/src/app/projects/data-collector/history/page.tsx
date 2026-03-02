"use client";

import { useState } from "react";
import { useProjectPaginatedData } from "@/hooks/useProjectData";
import type { CollectionHistory } from "@/lib/types";
import DataTable, { type Column } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";

const columns: Column<CollectionHistory>[] = [
  { key: "job_id", header: "작업 ID" },
  {
    key: "status",
    header: "상태",
    render: (h) => <StatusBadge status={h.status} />,
  },
  {
    key: "items_collected",
    header: "수집 건수",
    render: (h) => h.items_collected.toLocaleString(),
  },
  {
    key: "started_at",
    header: "시작 시간",
    render: (h) => format(new Date(h.started_at), "yyyy-MM-dd HH:mm:ss"),
  },
  {
    key: "finished_at",
    header: "종료 시간",
    render: (h) =>
      h.finished_at ? format(new Date(h.finished_at), "yyyy-MM-dd HH:mm:ss") : "-",
  },
  {
    key: "error_message",
    header: "오류 메시지",
    render: (h) =>
      h.error_message ? (
        <span className="text-red-600">{h.error_message}</span>
      ) : (
        "-"
      ),
  },
];

export default function DataCollectorHistoryPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectPaginatedData<CollectionHistory>(
    "data-collector",
    "jobs/history",
    page
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">수집 이력</h1>
        <p className="mt-1 text-sm text-gray-500">
          데이터 수집 실행 이력을 확인합니다
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(h) => h.id}
          page={page}
          totalPages={data?.total_pages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
