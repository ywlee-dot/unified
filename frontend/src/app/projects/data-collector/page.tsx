"use client";

import Link from "next/link";
import { Database, Play, AlertCircle, CheckCircle } from "lucide-react";
import { useProjectData } from "@/hooks/useProjectData";
import type { CollectorStats, CollectorJob } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import DataTable, { type Column } from "@/components/shared/DataTable";
import { format } from "date-fns";

const jobColumns: Column<CollectorJob>[] = [
  { key: "name", header: "작업명" },
  { key: "source_type", header: "소스 유형" },
  {
    key: "status",
    header: "상태",
    render: (job) => <StatusBadge status={job.status} />,
  },
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
];

export default function DataCollectorPage() {
  const { data: stats, isLoading: statsLoading } =
    useProjectData<CollectorStats>("data-collector", "stats");
  const { data: jobsRes, isLoading: jobsLoading } =
    useProjectData<{ items: CollectorJob[] }>("data-collector", "jobs?page=1&page_size=5");

  if (statsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">데이터 수집기</h1>
          <p className="mt-1 text-sm text-gray-500">
            외부 API 및 웹 소스에서 데이터를 수집하여 저장합니다
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Database className="h-5 w-5 text-blue-500" />}
            label="전체 작업"
            value={stats.total_jobs}
          />
          <StatCard
            icon={<Play className="h-5 w-5 text-green-500" />}
            label="활성 작업"
            value={stats.active_jobs}
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5 text-indigo-500" />}
            label="총 수집 건수"
            value={stats.total_collected.toLocaleString()}
          />
          <StatCard
            icon={<AlertCircle className="h-5 w-5 text-red-500" />}
            label="오류율"
            value={`${(stats.error_rate * 100).toFixed(1)}%`}
          />
        </div>
      )}

      {/* Recent Jobs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">최근 수집 작업</h2>
          <Link
            href="/projects/data-collector/jobs"
            className="text-sm text-primary-500 hover:text-primary-600"
          >
            전체 보기
          </Link>
        </div>
        {jobsLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            columns={jobColumns}
            data={jobsRes?.items ?? []}
            keyExtractor={(job) => job.id}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
