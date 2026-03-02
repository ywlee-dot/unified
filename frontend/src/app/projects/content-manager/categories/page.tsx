"use client";

import { useState } from "react";
import { useProjectPaginatedData } from "@/hooks/useProjectData";
import type { Category } from "@/lib/types";
import DataTable, { type Column } from "@/components/shared/DataTable";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { format } from "date-fns";

const columns: Column<Category>[] = [
  { key: "name", header: "카테고리명" },
  { key: "slug", header: "슬러그" },
  {
    key: "description",
    header: "설명",
    render: (c) => c.description ?? "-",
  },
  {
    key: "content_count",
    header: "콘텐츠 수",
    render: (c) => c.content_count.toLocaleString(),
  },
  {
    key: "created_at",
    header: "생성일",
    render: (c) => format(new Date(c.created_at), "yyyy-MM-dd"),
  },
];

export default function ContentCategoriesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectPaginatedData<Category>(
    "content-manager",
    "categories",
    page
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">카테고리 관리</h1>
        <p className="mt-1 text-sm text-gray-500">콘텐츠 카테고리를 관리합니다</p>
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
