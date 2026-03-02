"use client";

import Link from "next/link";
import { useProjectData } from "@/hooks/useProjectData";
import { useN8nTrigger } from "@/hooks/useN8nTrigger";
import type { Pipeline, PipelineRun } from "@/lib/types";
import TriggerButton from "@/components/n8n/TriggerButton";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import DataTable, { type Column } from "@/components/shared/DataTable";
import { format } from "date-fns";
import { GitBranch } from "lucide-react";

const runColumns: Column<PipelineRun>[] = [
  { key: "pipeline_name", header: "파이프라인" },
  {
    key: "status",
    header: "상태",
    render: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "records_processed",
    header: "처리 건수",
    render: (r) => r.records_processed.toLocaleString(),
  },
  {
    key: "records_failed",
    header: "실패 건수",
    render: (r) =>
      r.records_failed > 0 ? (
        <span className="text-red-600">{r.records_failed.toLocaleString()}</span>
      ) : (
        "0"
      ),
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
];

export default function DataPipelinePage() {
  const { data: pipelines, isLoading: pipelinesLoading } =
    useProjectData<Pipeline[]>("data-pipeline", "pipelines");
  const { data: runsRes, isLoading: runsLoading } =
    useProjectData<{ items: PipelineRun[] }>(
      "data-pipeline",
      "runs?page=1&page_size=10"
    );
  const { trigger, isRunning } = useN8nTrigger("data-pipeline");

  if (pipelinesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">데이터 파이프라인</h1>
        <p className="mt-1 text-sm text-gray-500">
          n8n 워크플로우를 통해 데이터 ETL 파이프라인을 실행합니다
        </p>
      </div>

      {/* Pipelines */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">파이프라인</h2>
        <div className="space-y-3">
          {(pipelines ?? []).map((pl) => (
            <div
              key={pl.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-cyan-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{pl.name}</p>
                    <StatusBadge status={pl.status} />
                  </div>
                  <p className="text-sm text-gray-500">
                    {pl.source} → {pl.destination}
                    {pl.last_run_at && (
                      <span className="ml-2">
                        마지막 실행:{" "}
                        {format(new Date(pl.last_run_at), "yyyy-MM-dd HH:mm")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <TriggerButton
                onClick={() => trigger(pl.id)}
                isLoading={isRunning}
                disabled={pl.status === "inactive"}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Runs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">최근 실행</h2>
          <Link
            href="/projects/data-pipeline/runs"
            className="text-sm text-primary-500 hover:text-primary-600"
          >
            전체 보기
          </Link>
        </div>
        {runsLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            columns={runColumns}
            data={runsRes?.items ?? []}
            keyExtractor={(r) => r.run_id}
          />
        )}
      </div>
    </div>
  );
}
