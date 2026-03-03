"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";

export default function DatasetSummaryResultsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">생성 결과</h1>
          <p className="mt-1 text-sm text-gray-500">
            이전에 생성된 데이터셋 설명/키워드 결과 목록
          </p>
        </div>
      </div>

      <EmptyState
        icon={<Sparkles className="h-12 w-12" />}
        title="저장된 결과가 없습니다"
        description="현재 생성 결과는 영속 저장되지 않습니다. 메인 페이지에서 파일을 업로드하여 새로운 결과를 생성하세요."
      >
        <Link
          href="/projects/dataset-summary"
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          <Sparkles className="h-4 w-4" />
          새로 생성하기
        </Link>
      </EmptyState>
    </div>
  );
}
