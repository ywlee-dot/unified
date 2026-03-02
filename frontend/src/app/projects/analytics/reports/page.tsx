"use client";

import { useState } from "react";
import { useProjectPaginatedData } from "@/hooks/useProjectData";
import type { AnalyticsReport } from "@/lib/types";
import DataTable, { type Column } from "@/components/shared/DataTable";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";

const columns: Column<AnalyticsReport>[] = [
  { key: "title", header: "제목" },
  { key: "summary", header: "요약", className: "max-w-xs truncate" },
  {
    key: "period_start",
    header: "기간 시작",
    render: (r) => format(new Date(r.period_start), "yyyy-MM-dd"),
  },
  {
    key: "period_end",
    header: "기간 종료",
    render: (r) => format(new Date(r.period_end), "yyyy-MM-dd"),
  },
  {
    key: "created_at",
    header: "생성일",
    render: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
  },
];

export default function AnalyticsReportsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectPaginatedData<AnalyticsReport>(
    "analytics",
    "reports",
    page
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">분석 리포트</h1>
        <p className="mt-1 text-sm text-gray-500">분석 리포트 목록을 확인합니다</p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(r) => r.id}
          page={page}
          totalPages={data?.total_pages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
