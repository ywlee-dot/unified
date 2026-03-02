"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  projects: "프로젝트",
  "data-collector": "데이터 수집기",
  analytics: "분석 대시보드",
  notifications: "알림 서비스",
  "content-manager": "콘텐츠 관리",
  "report-generator": "리포트 생성기",
  "data-pipeline": "데이터 파이프라인",
  jobs: "수집 작업",
  history: "이력",
  charts: "차트",
  reports: "리포트",
  templates: "템플릿",
  editor: "콘텐츠 편집",
  categories: "카테고리",
  results: "생성 결과",
  runs: "실행 이력",
};

export default function BreadcrumbNav() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

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
            {isLast ? (
              <span className="font-medium text-gray-900">{label}</span>
            ) : (
              <Link href={path} className="hover:text-gray-700">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
