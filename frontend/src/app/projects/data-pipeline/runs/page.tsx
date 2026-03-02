"use client";

import { useState } from "react";
import { useProjectPaginatedData } from "@/hooks/useProjectData";
import type { PipelineRun } from "@/lib/types";
import DataTable, { type Column } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function DataPipelineRunsPage() {
  const [page, setPage] = useState(1);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const { data, isLoading } = useProjectPaginatedData<PipelineRun>(
    "data-pipeline",
    "runs",
    page
  );

  const columns: Column<PipelineRun>[] = [
    { key: "pipeline_name", header: "파이프라인" },
    {
      key: "status",
      header: "상태",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "records_processed",
      header: "처리",
      render: (r) => r.records_processed.toLocaleString(),
    },
    {
      key: "records_failed",
      header: "실패",
      render: (r) =>
        r.records_failed > 0 ? (
          <span className="text-red-600">{r.records_failed.toLocaleString()}</span>
        ) : (
          "0"
        ),
    },
    {
      key: "started_at",
      header: "시작",
      render: (r) => format(new Date(r.started_at), "yyyy-MM-dd HH:mm"),
    },
    {
      key: "finished_at",
      header: "종료",
      render: (r) =>
        r.finished_at
          ? format(new Date(r.finished_at), "yyyy-MM-dd HH:mm")
          : "-",
    },
    {
      key: "actions",
      header: "로그",
      render: (r) =>
        r.logs && r.logs.length > 0 ? (
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
        ) : (
          "-"
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">실행 이력</h1>
        <p className="mt-1 text-sm text-gray-500">
          데이터 파이프라인 실행 이력을 확인합니다
        </p>
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

          {/* Expanded logs viewer */}
          {expandedRun && data?.items && (
            <div className="mt-4">
              {data.items
                .filter((r) => r.run_id === expandedRun)
                .map((r) => (
                  <div
                    key={r.run_id}
                    className="rounded-lg border border-gray-200 bg-gray-900 p-4"
                  >
                    <h3 className="mb-2 text-sm font-medium text-gray-400">
                      실행 로그 - {r.pipeline_name}
                    </h3>
                    <pre className="max-h-64 overflow-auto text-xs text-green-400">
                      {r.logs?.join("\n") || "로그가 없습니다."}
                    </pre>
                    {r.error_message && (
                      <p className="mt-2 text-xs text-red-400">
                        오류: {r.error_message}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
