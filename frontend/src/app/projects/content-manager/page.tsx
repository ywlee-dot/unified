"use client";

import Link from "next/link";
import { FileText, FilePlus, FileCheck, Archive } from "lucide-react";
import { useProjectData } from "@/hooks/useProjectData";
import type { Content } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import DataTable, { type Column } from "@/components/shared/DataTable";
import { format } from "date-fns";

interface ContentStats {
  total_contents: number;
  published: number;
  draft: number;
  archived: number;
}

const contentColumns: Column<Content>[] = [
  { key: "title", header: "제목" },
  { key: "category_name", header: "카테고리" },
  {
    key: "status",
    header: "상태",
    render: (c) => <StatusBadge status={c.status} />,
  },
  { key: "author", header: "작성자" },
  {
    key: "updated_at",
    header: "수정일",
    render: (c) => format(new Date(c.updated_at), "yyyy-MM-dd HH:mm"),
  },
];

export default function ContentManagerPage() {
  const { data: stats, isLoading: statsLoading } =
    useProjectData<ContentStats>("content-manager", "stats");
  const { data: contentsRes, isLoading: contentsLoading } =
    useProjectData<{ items: Content[] }>(
      "content-manager",
      "contents?page=1&page_size=5"
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
        <h1 className="text-2xl font-bold text-gray-900">콘텐츠 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          콘텐츠를 생성하고 발행 상태를 관리합니다
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<FileText className="h-5 w-5 text-blue-500" />}
            label="전체 콘텐츠"
            value={stats.total_contents}
          />
          <StatCard
            icon={<FileCheck className="h-5 w-5 text-green-500" />}
            label="게시됨"
            value={stats.published}
          />
          <StatCard
            icon={<FilePlus className="h-5 w-5 text-yellow-500" />}
            label="임시저장"
            value={stats.draft}
          />
          <StatCard
            icon={<Archive className="h-5 w-5 text-gray-500" />}
            label="보관됨"
            value={stats.archived}
          />
        </div>
      )}

      {/* Recent Contents */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">최근 콘텐츠</h2>
          <Link
            href="/projects/content-manager/editor"
            className="text-sm text-primary-500 hover:text-primary-600"
          >
            전체 보기
          </Link>
        </div>
        {contentsLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            columns={contentColumns}
            data={contentsRes?.items ?? []}
            keyExtractor={(c) => c.id}
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
