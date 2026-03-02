"use client";

import Link from "next/link";
import { Send, CheckCircle, XCircle, Percent } from "lucide-react";
import { useProjectData } from "@/hooks/useProjectData";
import type { NotificationStats, NotificationHistory } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import DataTable, { type Column } from "@/components/shared/DataTable";
import { format } from "date-fns";

const historyColumns: Column<NotificationHistory>[] = [
  { key: "template_name", header: "템플릿" },
  { key: "channel", header: "채널" },
  { key: "recipient", header: "수신자" },
  {
    key: "status",
    header: "상태",
    render: (h) => <StatusBadge status={h.status} />,
  },
  {
    key: "sent_at",
    header: "발송 시간",
    render: (h) => format(new Date(h.sent_at), "yyyy-MM-dd HH:mm"),
  },
];

export default function NotificationsPage() {
  const { data: stats, isLoading: statsLoading } =
    useProjectData<NotificationStats>("notifications", "stats");
  const { data: historyRes, isLoading: historyLoading } =
    useProjectData<{ items: NotificationHistory[] }>(
      "notifications",
      "history?page=1&page_size=5"
    );

  if (statsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">알림 서비스</h1>
        <p className="mt-1 text-sm text-gray-500">
          다양한 채널로 알림을 발송하고 관리합니다
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Send className="h-5 w-5 text-blue-500" />}
            label="총 발송"
            value={stats.total_sent.toLocaleString()}
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5 text-green-500" />}
            label="전달 완료"
            value={stats.delivered.toLocaleString()}
          />
          <StatCard
            icon={<XCircle className="h-5 w-5 text-red-500" />}
            label="실패"
            value={stats.failed.toLocaleString()}
          />
          <StatCard
            icon={<Percent className="h-5 w-5 text-indigo-500" />}
            label="전달률"
            value={`${(stats.delivery_rate * 100).toFixed(1)}%`}
          />
        </div>
      )}

      {/* Recent History */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">최근 발송 이력</h2>
          <Link
            href="/projects/notifications/history"
            className="text-sm text-primary-500 hover:text-primary-600"
          >
            전체 보기
          </Link>
        </div>
        {historyLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            columns={historyColumns}
            data={historyRes?.items ?? []}
            keyExtractor={(h) => h.id}
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
