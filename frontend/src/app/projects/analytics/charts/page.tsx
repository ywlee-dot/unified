"use client";

import { useProjectData } from "@/hooks/useProjectData";
import type { ChartData } from "@/lib/types";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function AnalyticsChartsPage() {
  const { data: lineData, isLoading: lineLoading } =
    useProjectData<ChartData>("analytics", "charts/line");
  const { data: barData, isLoading: barLoading } =
    useProjectData<ChartData>("analytics", "charts/bar");
  const { data: pieData, isLoading: pieLoading } =
    useProjectData<ChartData>("analytics", "charts/pie");

  const isLoading = lineLoading || barLoading || pieLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const lineChartData =
    lineData?.labels.map((label, i) => ({
      name: label,
      ...Object.fromEntries(
        (lineData.datasets ?? []).map((ds) => [ds.label, ds.data[i]])
      ),
    })) ?? [];

  const barChartData =
    barData?.labels.map((label, i) => ({
      name: label,
      ...Object.fromEntries(
        (barData.datasets ?? []).map((ds) => [ds.label, ds.data[i]])
      ),
    })) ?? [];

  const pieChartData =
    pieData?.labels.map((label, i) => ({
      name: label,
      value: pieData.datasets[0]?.data[i] ?? 0,
      color: pieData.datasets[0]?.color ?? "#3B82F6",
    })) ?? [];

  const PIE_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">차트</h1>
        <p className="mt-1 text-sm text-gray-500">다양한 시각화 차트를 확인합니다</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Line Chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">라인 차트</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {lineData?.datasets.map((ds) => (
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
        </div>

        {/* Bar Chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">바 차트</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {barData?.datasets.map((ds) => (
                  <Bar key={ds.label} dataKey={ds.label} fill={ds.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">파이 차트</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {pieChartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
