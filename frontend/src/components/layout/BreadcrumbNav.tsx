"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { PROJECT_PIPELINES } from "@/lib/pipeline-data";

const SEGMENT_LABELS: Record<string, string> = {
  projects: "프로젝트",
  architecture: "아키텍처",
  "report-generator": "리포트 생성기",
  "data-pipeline": "데이터 파이프라인",
  "dataset-summary": "데이터셋 설명 생성",
  "open-data-analyzer": "개방 가능 여부 판단",
  "gov-news-crawler": "정부 뉴스 크롤링",
  "evaluation-rag": "평가편람",
  summarize: "텍스트 요약",
  jobs: "수집 작업",
  history: "이력",
  charts: "차트",
  reports: "리포트",
  templates: "템플릿",
  editor: "콘텐츠 편집",
  categories: "카테고리",
  results: "생성 결과",
  runs: "실행 이력",
  keywords: "키워드",
  search: "검색",
};

function BreadcrumbContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = pathname.split("/").filter(Boolean);

  // Check for architecture project query param
  const projectSlug = pathname === "/architecture" ? searchParams.get("project") : null;
  const projectPipeline = projectSlug ? PROJECT_PIPELINES[projectSlug] : null;

  return (
    <nav className="flex items-center gap-1 px-6 py-3 text-sm text-gray-500">
      <Link href="/" className="hover:text-gray-700">
        <Home className="h-4 w-4" />
      </Link>
      {segments.map((segment, index) => {
        const path = "/" + segments.slice(0, index + 1).join("/");
        const label = SEGMENT_LABELS[segment] || segment;
        const isLast = index === segments.length - 1;

        return (
          <span key={path} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-gray-400" />
            {isLast && !projectPipeline ? (
              <span className="font-medium text-gray-900">{label}</span>
            ) : (
              <Link href={path} className="hover:text-gray-700">
                {label}
              </Link>
            )}
          </span>
        );
      })}
      {projectPipeline && (
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-gray-400" />
          <span className="font-medium text-gray-900">{projectPipeline.name}</span>
        </span>
      )}
    </nav>
  );
}

export default function BreadcrumbNav() {
  return (
    <Suspense fallback={<nav className="px-6 py-3 text-sm text-gray-500"><Home className="h-4 w-4" /></nav>}>
      <BreadcrumbContent />
    </Suspense>
  );
}
