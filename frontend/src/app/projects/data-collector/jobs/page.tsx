"use client";

import { useState } from "react";
import { useProjectPaginatedData } from "@/hooks/useProjectData";
import type { CollectorJob } from "@/lib/types";
import DataTable, { type Column } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";

const columns: Column<CollectorJob>[] = [
  { key: "name", header: "작업명" },
  { key: "source_type", header: "소스 유형" },
  { key: "source_url", header: "소스 URL", className: "max-w-xs truncate" },
  {
    key: "status",
    header: "상태",
    render: (job) => <StatusBadge status={job.status} />,
  },
  { key: "schedule", header: "스케줄", render: (job) => job.schedule ?? "-" },
  {
    key: "collected_count",
    header: "수집 건수",
    render: (job) => job.collected_count.toLocaleString(),
  },
  {
    key: "last_run_at",
    header: "마지막 실행",
    render: (job) =>
      job.last_run_at ? format(new Date(job.last_run_at), "yyyy-MM-dd HH:mm") : "-",
  },
  {
    key: "created_at",
    header: "생성일",
    render: (job) => format(new Date(job.created_at), "yyyy-MM-dd"),
  },
];

export default function DataCollectorJobsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectPaginatedData<CollectorJob>(
    "data-collector",
    "jobs",
    page
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">수집 작업 목록</h1>
        <p className="mt-1 text-sm text-gray-500">
          등록된 데이터 수집 작업을 관리합니다
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
          keyExtractor={(job) => job.id}
          page={page}
          totalPages={data?.total_pages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
