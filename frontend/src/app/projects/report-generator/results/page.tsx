"use client";

import { useState } from "react";
import { useProjectPaginatedData } from "@/hooks/useProjectData";
import type { N8nRun } from "@/lib/types";
import DataTable, { type Column } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import ResultViewer from "@/components/n8n/ResultViewer";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function ReportResultsPage() {
  const [page, setPage] = useState(1);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const { data, isLoading } = useProjectPaginatedData<N8nRun>(
    "report-generator",
    "runs",
    page
  );

  const columns: Column<N8nRun>[] = [
    { key: "workflow_name", header: "워크플로우" },
    {
      key: "status",
      header: "상태",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "started_at",
      header: "시작 시간",
      render: (r) => format(new Date(r.started_at), "yyyy-MM-dd HH:mm"),
    },
    {
      key: "finished_at",
      header: "종료 시간",
      render: (r) =>
        r.finished_at
          ? format(new Date(r.finished_at), "yyyy-MM-dd HH:mm")
          : "-",
    },
    {
      key: "actions",
      header: "상세",
      render: (r) => (
        <button
          onClick={() =>
            setExpandedRun(expandedRun === r.run_id ? null : r.run_id)
          }
          className="text-primary-500 hover:text-primary-600"
        >
          {expandedRun === r.run_id ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">생성 결과</h1>
        <p className="mt-1 text-sm text-gray-500">리포트 생성 결과를 확인합니다</p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            keyExtractor={(r) => r.run_id}
            page={page}
            totalPages={data?.total_pages ?? 1}
            onPageChange={setPage}
          />

          {/* Expanded result viewer */}
          {expandedRun && data?.items && (
            <div className="mt-4">
              {data.items
                .filter((r) => r.run_id === expandedRun)
                .map((r) => (
                  <ResultViewer key={r.run_id} run={r} />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
