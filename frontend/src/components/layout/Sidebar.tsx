"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  ShieldCheck,
  Newspaper,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Workflow,
  ClipboardCheck,
  Database,
  Blocks,
  PanelLeft,
  Search,
  BookOpen,
  BrainCircuit,
  Bell,
  BarChart3,
  FileSearch,
  ClipboardList,
  Landmark,
  Compass,
  Eye,
} from "lucide-react";

interface SidebarItem {
  label: string;
  path?: string; // undefined = 페이지 없음 (사이드바 표시만)
  icon: React.ReactNode;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

const SECTIONS: SidebarSection[] = [
  {
    // 구: "개방"
    title: "개방/활용 Agent",
    items: [
      // 구: "개방 가능 여부 판단"
      { label: "개방 가능 검증", path: "/projects/open-data-analyzer", icon: <ShieldCheck className="h-[18px] w-[18px]" /> },
      // 구: "민간 우수사례 검색"
      { label: "민간 우수사례 탐색", path: "/projects/best-practice-search", icon: <Search className="h-[18px] w-[18px]" /> },
      // 구: "개방데이터 설명/키워드" → 임시 매핑
      { label: "메타데이터 자동 완성", path: "/projects/dataset-summary", icon: <Sparkles className="h-[18px] w-[18px]" /> },
      // 구: "AI 친화·고가치 데이터"
      { label: "AI 데이터셋 정의", path: "/projects/ai-data-openness", icon: <FileSearch className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    // 구: "품질"
    title: "데이터 품질 Agent",
    items: [
      // 구: "업무 규칙 생성"
      { label: "업무규칙 자동 생성", path: "/projects/business-rule-gen", icon: <ClipboardCheck className="h-[18px] w-[18px]" /> },
      // 구: "값진단 사전예외처리"
      { label: "값 진단 제외 대상", path: "/projects/data-quality-pretest", icon: <Workflow className="h-[18px] w-[18px]" /> },
      // 구: "서비스 진단" → 임시 매핑
      { label: "진단 규칙 자동 생성", path: "/diagnosis", icon: <ClipboardList className="h-[18px] w-[18px]" /> },
      // 구: "입찰공고 모니터링" → 임시 매핑
      { label: "데이터 표준 사전", path: "/projects/bid-monitor", icon: <BookOpen className="h-[18px] w-[18px]" /> },
      // 구: 대시보드(/) → 임시 매핑
      { label: "오류데이터 개선 가이드", path: "/", icon: <FileText className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    // 구: "데이터기반행정"
    title: "데이터기반행정 Agent",
    items: [
      // 구: "공유데이터 제공 노력"
      { label: "공유데이터 조사/발굴", path: "/projects/effort-public-data", icon: <Database className="h-[18px] w-[18px]" /> },
      // 구: "분석주제 탐색"
      { label: "분석 과제 주제 발굴", path: "/projects/da-topic-explorer", icon: <Compass className="h-[18px] w-[18px]" /> },
      // 구: "공공데이터 활용도 제고" → 임시 매핑
      { label: "분석 결과 타당성 검토", path: "/projects/data-utilization-report", icon: <BarChart3 className="h-[18px] w-[18px]" /> },
      // 구: "설문조사 생성·분석" → 임시 매핑
      { label: "역량 진단 계획 수립", path: "/projects/survey-platform", icon: <ClipboardCheck className="h-[18px] w-[18px]" /> },
      // 구: "데이터기반행정 활성화" → 임시 매핑
      { label: "역량 개선 가이드", path: "/projects/data-government-effort", icon: <Landmark className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    // 신규 섹션
    title: "평가 공통 Agent",
    items: [
      // 구: "평가편람"
      { label: "평가편람 RAG 자동 평가", path: "/projects/evaluation-rag", icon: <BookOpen className="h-[18px] w-[18px]" /> },
      // 구: "AI 도입 활용 사례 보고서" → 임시 매핑
      { label: "정성보고서 자동 작성", path: "/projects/ai-case-report", icon: <FileText className="h-[18px] w-[18px]" /> },
      // 구: "정부 뉴스 크롤링"
      { label: "정책 변화 실시간 모니터링", path: "/projects/gov-news-crawler", icon: <Newspaper className="h-[18px] w-[18px]" /> },
    ],
  },
  // 미매핑: { label: "입찰공고 모니터링", path: "/projects/bid-monitor" } — 새 목록에 대응 항목 없음
  {
    title: "개발 도구",
    items: [
      { label: "HWP 미리보기 컴포넌트", path: "/hwp-preview", icon: <Eye className="h-[18px] w-[18px]" /> },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items).filter((item) => !!item.path);

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [archExpanded, setArchExpanded] = useState(false);

  const isActive = (path: string) => {
    if (path.startsWith("/architecture?project=")) {
      const slug = path.split("=")[1];
      return pathname === "/architecture" && searchParams.get("project") === slug;
    }
    return pathname === path || pathname.startsWith(path + "/");
  };

  const renderItem = (item: SidebarItem) => {
    // 페이지 없는 항목: 일반 항목과 동일하게 표시 (임시)
    if (!item.path) {
      return (
        <div
          key={item.label}
          className={clsx(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-text",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? item.label : undefined}
        >
          <span>{item.icon}</span>
          {!collapsed && <span className="truncate">{item.label}</span>}
        </div>
      );
    }

    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        href={item.path}
        className={clsx(
          "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
          collapsed && "justify-center px-0",
          active
            ? "text-sidebar-text-active"
            : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
        )}
        style={active ? { backgroundColor: "rgba(49, 130, 246, 0.12)" } : undefined}
        title={collapsed ? item.label : undefined}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-active"
            aria-hidden="true"
          />
        )}
        <span className={clsx(active ? "text-sidebar-active" : "")}>
          {item.icon}
        </span>
        {!collapsed && (
          <span className="truncate">{item.label}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={clsx(
        "flex flex-col bg-sidebar-bg transition-all duration-200 ease-[cubic-bezier(0.33,0,0.67,1)]",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div
        className={clsx(
          "flex items-center gap-2 px-4 py-5",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-active">
          <PanelLeft className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-tight text-white">
            TU AI Agent 서비스
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2">
        {/* 대시보드 */}
        {renderItem({
          label: "대시보드",
          path: "/dashboard",
          icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
        })}

        {/* Sections */}
        {SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mt-6 mb-1 px-3 text-overline font-semibold uppercase tracking-widest text-white/60">
                {section.title}
              </p>
            )}
            {collapsed && <div className="mt-4" />}
            <div className="space-y-0.5">
              {section.items.map(renderItem)}
            </div>
          </div>
        ))}

        {/* Architecture */}
        {!collapsed && (
          <button
            onClick={() => setArchExpanded(!archExpanded)}
            className="mt-6 mb-1 flex w-full items-center justify-between px-3 transition-colors hover:text-white"
          >
            <p className="text-overline font-semibold uppercase tracking-widest text-sidebar-text">
              아키텍처
            </p>
            <ChevronDown
              className={clsx(
                "h-3 w-3 text-sidebar-text transition-transform duration-200",
                archExpanded && "rotate-180"
              )}
            />
          </button>
        )}
        {collapsed && (
          <Link
            href="/architecture"
            className={clsx(
              "mt-4 flex items-center justify-center rounded-md py-2 text-sm transition-all duration-200",
              isActive("/architecture")
                ? "text-sidebar-active"
                : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
            )}
            title="아키텍처"
          >
            <Blocks className="h-[18px] w-[18px]" />
          </Link>
        )}
        {archExpanded && !collapsed && (
          <div className="space-y-0.5">
            {ALL_ITEMS.map((item) => {
              const slug = item.path!.replace("/projects/", "");
              return renderItem({
                label: item.label,
                path: `/architecture?project=${slug}`,
                icon: item.icon,
              });
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-2">
        <div className="mb-2 h-px bg-white/5" />
        <Link
          href="/settings"
          className={clsx(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-text transition-all duration-200 hover:bg-sidebar-hover hover:text-sidebar-text-active",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "설정" : undefined}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>설정</span>}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            "mt-0.5 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-text transition-all duration-200 hover:bg-sidebar-hover hover:text-sidebar-text-active",
            collapsed && "justify-center px-0"
          )}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span>접기</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense>
      <SidebarContent />
    </Suspense>
  );
}
