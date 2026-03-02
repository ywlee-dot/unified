"use client";

import { useState } from "react";
import { useProjectPaginatedData } from "@/hooks/useProjectData";
import type { NotificationHistory } from "@/lib/types";
import DataTable, { type Column } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";

const columns: Column<NotificationHistory>[] = [
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
  {
    key: "error_message",
    header: "오류",
    render: (h) =>
      h.error_message ? (
        <span className="text-red-600">{h.error_message}</span>
      ) : (
        "-"
      ),
  },
];

export default function NotificationHistoryPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectPaginatedData<NotificationHistory>(
    "notifications",
    "history",
    page
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">발송 이력</h1>
        <p className="mt-1 text-sm text-gray-500">알림 발송 이력을 확인합니다</p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(h) => h.id}
          page={page}
          totalPages={data?.total_pages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
