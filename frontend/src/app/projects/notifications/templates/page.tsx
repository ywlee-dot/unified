"use client";

import { useState } from "react";
import { useProjectPaginatedData } from "@/hooks/useProjectData";
import type { NotificationTemplate } from "@/lib/types";
import DataTable, { type Column } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-800",
  sms: "bg-green-100 text-green-800",
  webhook: "bg-purple-100 text-purple-800",
  slack: "bg-orange-100 text-orange-800",
};

const columns: Column<NotificationTemplate>[] = [
  { key: "name", header: "템플릿명" },
  {
    key: "channel",
    header: "채널",
    render: (t) => (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CHANNEL_COLORS[t.channel] || "bg-gray-100 text-gray-800"}`}
      >
        {t.channel}
      </span>
    ),
  },
  { key: "subject", header: "제목", render: (t) => t.subject ?? "-" },
  {
    key: "variables",
    header: "변수",
    render: (t) => (
      <span className="text-xs text-gray-500">
        {t.variables.length > 0 ? t.variables.join(", ") : "-"}
      </span>
    ),
  },
  {
    key: "created_at",
    header: "생성일",
    render: (t) => format(new Date(t.created_at), "yyyy-MM-dd"),
  },
];

export default function NotificationTemplatesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectPaginatedData<NotificationTemplate>(
    "notifications",
    "templates",
    page
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">알림 템플릿</h1>
        <p className="mt-1 text-sm text-gray-500">알림 발송에 사용되는 템플릿을 관리합니다</p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(t) => t.id}
          page={page}
          totalPages={data?.total_pages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
