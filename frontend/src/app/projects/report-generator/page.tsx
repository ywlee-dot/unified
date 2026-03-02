"use client";

import Link from "next/link";
import { useProjectData } from "@/hooks/useProjectData";
import { useN8nTrigger } from "@/hooks/useN8nTrigger";
import type { N8nWorkflow, N8nRun } from "@/lib/types";
import TriggerButton from "@/components/n8n/TriggerButton";
import PipelineStatus from "@/components/n8n/PipelineStatus";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import DataTable, { type Column } from "@/components/shared/DataTable";
import { format } from "date-fns";
import { FileText } from "lucide-react";

const runColumns: Column<N8nRun>[] = [
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
    key: "download_url",
    header: "결과",
    render: (r) =>
      r.download_url ? (
        <a
          href={r.download_url}
          className="text-primary-500 hover:text-primary-600"
          download
        >
          다운로드
        </a>
      ) : r.status === "failed" ? (
        <span className="text-red-500">실패</span>
      ) : (
        "-"
      ),
  },
];

export default function ReportGeneratorPage() {
  const { data: workflows, isLoading: workflowsLoading } =
    useProjectData<N8nWorkflow[]>("report-generator", "workflows");
  const { data: runsRes, isLoading: runsLoading } =
    useProjectData<{ items: N8nRun[] }>(
      "report-generator",
      "runs?page=1&page_size=10"
    );
  const { trigger, isRunning } = useN8nTrigger("report-generator");

  if (workflowsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">리포트 생성기</h1>
        <p className="mt-1 text-sm text-gray-500">
          n8n 워크플로우를 통해 자동으로 리포트를 생성합니다
        </p>
      </div>

      {/* Workflows */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">워크플로우</h2>
        <div className="space-y-3">
          {(workflows ?? []).map((wf) => (
            <div
              key={wf.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-gray-900">{wf.name}</p>
                  <p className="text-sm text-gray-500">
                    {wf.description}
                    {wf.last_run_at && (
                      <span className="ml-2">
                        마지막 실행:{" "}
                        {format(new Date(wf.last_run_at), "yyyy-MM-dd HH:mm")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <TriggerButton
                onClick={() => trigger(wf.id)}
                isLoading={isRunning}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Runs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">실행 이력</h2>
          <Link
            href="/projects/report-generator/results"
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
