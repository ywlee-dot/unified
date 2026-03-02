"use client";

import Link from "next/link";
import { Eye, MousePointerClick, Users, TrendingUp } from "lucide-react";
import { useProjectData } from "@/hooks/useProjectData";
import type { DashboardSummary, ChartData } from "@/lib/types";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AnalyticsPage() {
  const { data: summary, isLoading: summaryLoading } =
    useProjectData<DashboardSummary>("analytics", "dashboard");
  const { data: chartData, isLoading: chartLoading } =
    useProjectData<ChartData>("analytics", "charts/line");

  if (summaryLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const lineData =
    chartData?.labels.map((label, i) => ({
      name: label,
      ...Object.fromEntries(
        (chartData.datasets ?? []).map((ds) => [ds.label, ds.data[i]])
      ),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">분석 대시보드</h1>
          <p className="mt-1 text-sm text-gray-500">
            수집된 데이터를 시각화하고 분석합니다
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Eye className="h-5 w-5 text-blue-500" />}
            label="총 조회수"
            value={summary.total_views.toLocaleString()}
          />
          <StatCard
            icon={<MousePointerClick className="h-5 w-5 text-purple-500" />}
            label="총 이벤트"
            value={summary.total_events.toLocaleString()}
          />
          <StatCard
            icon={<Users className="h-5 w-5 text-green-500" />}
            label="활성 사용자"
            value={summary.active_users.toLocaleString()}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
            label="전환율"
            value={`${(summary.conversion_rate * 100).toFixed(1)}%`}
          />
        </div>
      )}

      {/* Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">추이</h2>
          <Link
            href="/projects/analytics/charts"
            className="text-sm text-primary-500 hover:text-primary-600"
          >
            전체 차트
          </Link>
        </div>
        {chartLoading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                {chartData?.datasets.map((ds) => (
                  <Line
                    key={ds.label}
                    type="monotone"
                    dataKey={ds.label}
                    stroke={ds.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
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
