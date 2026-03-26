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
} from "lucide-react";

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

const SECTIONS: SidebarSection[] = [
  {
    title: "개방",
    items: [
      { label: "개방 가능 여부 판단", path: "/projects/open-data-analyzer", icon: <ShieldCheck className="h-[18px] w-[18px]" /> },
      { label: "개방데이터 설명/키워드", path: "/projects/dataset-summary", icon: <Sparkles className="h-[18px] w-[18px]" /> },
      { label: "민간 우수사례 검색", path: "/projects/best-practice-search", icon: <Search className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    title: "품질",
    items: [
      { label: "값진단 제외 대상", path: "/projects/test1", icon: <Workflow className="h-[18px] w-[18px]" /> },
      { label: "업무 규칙 생성", path: "/projects/business-rule-gen", icon: <ClipboardCheck className="h-[18px] w-[18px]" /> },
      { label: "평가편람", path: "/projects/evaluation-rag", icon: <BookOpen className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    title: "데이터기반행정",
    items: [
      { label: "AI 도입 활용 사례 보고서", path: "/projects/ai-case-report", icon: <BrainCircuit className="h-[18px] w-[18px]" /> },
      { label: "공유데이터 제공 노력", path: "/projects/effort-public-data", icon: <Database className="h-[18px] w-[18px]" /> },
      { label: "정부 뉴스 크롤링", path: "/projects/gov-news-crawler", icon: <Newspaper className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    title: "유틸",
    items: [
      { label: "입찰공고 모니터링", path: "/projects/bid-monitor", icon: <Bell className="h-[18px] w-[18px]" /> },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);

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
            Unified
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {/* Dashboard */}
        {(() => {
          const active = pathname === "/";
          return (
            <Link
              href="/"
              className={clsx(
                "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                collapsed && "justify-center px-0",
                active
                  ? "text-sidebar-text-active"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
              )}
              style={active ? { backgroundColor: "rgba(49, 130, 246, 0.12)" } : undefined}
              title={collapsed ? "대시보드" : undefined}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-active"
                  aria-hidden="true"
                />
              )}
              <span className={clsx(active ? "text-sidebar-active" : "")}>
                <LayoutDashboard className="h-[18px] w-[18px]" />
              </span>
              {!collapsed && <span>대시보드</span>}
            </Link>
          );
        })()}

        {/* Sections */}
        {SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mt-6 mb-1 px-3 text-overline font-semibold uppercase tracking-widest text-sidebar-text">
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
              const slug = item.path.replace("/projects/", "");
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
