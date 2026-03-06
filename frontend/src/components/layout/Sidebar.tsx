"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  FileText,
  GitBranch,
  GitMerge,
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
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import type { Project } from "@/lib/types";

const ICON_MAP: Record<string, React.ReactNode> = {
  sparkles: <Sparkles className="h-5 w-5" />,
  "shield-check": <ShieldCheck className="h-5 w-5" />,
  newspaper: <Newspaper className="h-5 w-5" />,
  "clipboard-check": <ClipboardCheck className="h-5 w-5" />,
  "file-text": <FileText className="h-5 w-5" />,
  "git-branch": <GitBranch className="h-5 w-5" />,
  "git-merge": <GitMerge className="h-5 w-5" />,
  workflow: <Workflow className="h-5 w-5" />,
  database: <Database className="h-5 w-5" />,
};

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const FALLBACK_STANDARD: SidebarItem[] = [
  { label: "데이터셋 설명 생성", path: "/projects/dataset-summary", icon: <Sparkles className="h-5 w-5" /> },
  { label: "개방 가능 여부 판단", path: "/projects/open-data-analyzer", icon: <ShieldCheck className="h-5 w-5" /> },
  { label: "정부 뉴스 크롤링", path: "/projects/gov-news-crawler", icon: <Newspaper className="h-5 w-5" /> },
  { label: "평가편람", path: "/projects/evaluation-rag", icon: <ClipboardCheck className="h-5 w-5" /> },
];

const FALLBACK_N8N: SidebarItem[] = [
  { label: "리포트 생성기", path: "/projects/report-generator", icon: <FileText className="h-5 w-5" /> },
  { label: "데이터 파이프라인", path: "/projects/data-pipeline", icon: <GitMerge className="h-5 w-5" /> },
  { label: "텍스트 요약", path: "/projects/summarize", icon: <FileText className="h-5 w-5" /> },
  { label: "값진단 사전예외처리", path: "/projects/test1", icon: <Workflow className="h-5 w-5" /> },
  { label: "공유데이터 제공 노력", path: "/projects/effort-public-data", icon: <Database className="h-5 w-5" /> },
];

function projectToSidebarItem(project: Project): SidebarItem {
  return {
    label: project.name,
    path: `/projects/${project.slug}`,
    icon: ICON_MAP[project.icon] || <Database className="h-5 w-5" />,
  };
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [archExpanded, setArchExpanded] = useState(false);
  const { projects } = useProjects();

  const standardProjects = projects.length > 0
    ? projects.filter((p) => p.project_type === "standard").map(projectToSidebarItem)
    : FALLBACK_STANDARD;

  const n8nProjects = projects.length > 0
    ? projects.filter((p) => p.project_type === "n8n").map(projectToSidebarItem)
    : FALLBACK_N8N;

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const renderItem = (item: SidebarItem) => (
    <Link
      key={item.path}
      href={item.path}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive(item.path)
          ? "bg-blue-600 text-white"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
      )}
    >
      {item.icon}
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  return (
    <aside
      className={clsx(
        "flex flex-col bg-slate-800 text-white transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-5">
        <Workflow className="h-7 w-7 shrink-0 text-blue-400" />
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight">
            Unified Workspace
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {/* Dashboard */}
        <Link
          href="/"
          className={clsx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/"
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-700 hover:text-white"
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          {!collapsed && <span>대시보드</span>}
        </Link>

        {/* Standard Projects */}
        {!collapsed && (
          <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            프로젝트
          </p>
        )}
        <div className="mt-1 space-y-1">
          {standardProjects.map(renderItem)}
        </div>

        {/* n8n Projects */}
        {!collapsed && (
          <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            n8n 파이프라인
          </p>
        )}
        <div className="mt-1 space-y-1">{n8nProjects.map(renderItem)}</div>

        {/* Architecture */}
        {!collapsed && (
          <button
            onClick={() => setArchExpanded(!archExpanded)}
            className="mt-6 flex w-full items-center justify-between px-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              아키텍처
            </p>
            <ChevronDown
              className={clsx(
                "h-3 w-3 text-slate-500 transition-transform duration-200",
                archExpanded && "rotate-180"
              )}
            />
          </button>
        )}
        {collapsed && (
          <Link
            href="/architecture"
            className={clsx(
              "mt-4 flex items-center justify-center rounded-lg px-3 py-2 text-sm transition-colors",
              isActive("/architecture")
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
            )}
          >
            <Blocks className="h-5 w-5" />
          </Link>
        )}
        {archExpanded && !collapsed && (
          <div className="mt-1 space-y-1">
            {renderItem({
              label: "Unified 전체",
              path: "/architecture",
              icon: <Blocks className="h-5 w-5" />,
            })}
            {[...standardProjects, ...n8nProjects].map((item) =>
              renderItem({
                label: item.label,
                path: `/architecture/${item.path.replace("/projects/", "")}`,
                icon: item.icon,
              })
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 px-3 py-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          <Settings className="h-5 w-5" />
          {!collapsed && <span>설정</span>}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 flex w-full items-center justify-center rounded-lg py-2 text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
