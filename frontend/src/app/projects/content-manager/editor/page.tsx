"use client";

import { useState } from "react";
import { useProjectPaginatedData } from "@/hooks/useProjectData";
import type { Content } from "@/lib/types";
import DataTable, { type Column } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";

const columns: Column<Content>[] = [
  { key: "title", header: "제목" },
  { key: "category_name", header: "카테고리" },
  {
    key: "status",
    header: "상태",
    render: (c) => <StatusBadge status={c.status} />,
  },
  { key: "author", header: "작성자" },
  {
    key: "tags",
    header: "태그",
    render: (c) => (
      <div className="flex flex-wrap gap-1">
        {c.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
          >
            {tag}
          </span>
        ))}
      </div>
    ),
  },
  {
    key: "published_at",
    header: "발행일",
    render: (c) =>
      c.published_at
        ? format(new Date(c.published_at), "yyyy-MM-dd")
        : "-",
  },
  {
    key: "updated_at",
    header: "수정일",
    render: (c) => format(new Date(c.updated_at), "yyyy-MM-dd HH:mm"),
  },
];

export default function ContentEditorPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectPaginatedData<Content>(
    "content-manager",
    "contents",
    page
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">콘텐츠 편집</h1>
        <p className="mt-1 text-sm text-gray-500">콘텐츠 목록을 확인하고 관리합니다</p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(c) => c.id}
          page={page}
          totalPages={data?.total_pages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
