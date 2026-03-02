"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Database,
  BarChart3,
  Bell,
  FileText,
  GitBranch,
  Settings,
  ChevronLeft,
  ChevronRight,
  Workflow,
} from "lucide-react";

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const STANDARD_PROJECTS: SidebarItem[] = [
  {
    label: "데이터 수집기",
    path: "/projects/data-collector",
    icon: <Database className="h-5 w-5" />,
  },
  {
    label: "분석 대시보드",
    path: "/projects/analytics",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    label: "알림 서비스",
    path: "/projects/notifications",
    icon: <Bell className="h-5 w-5" />,
  },
  {
    label: "콘텐츠 관리",
    path: "/projects/content-manager",
    icon: <FileText className="h-5 w-5" />,
  },
];

const N8N_PROJECTS: SidebarItem[] = [
  {
    label: "리포트 생성기",
    path: "/projects/report-generator",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    label: "데이터 파이프라인",
    path: "/projects/data-pipeline",
    icon: <GitBranch className="h-5 w-5" />,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
          {STANDARD_PROJECTS.map(renderItem)}
        </div>

        {/* n8n Projects */}
        {!collapsed && (
          <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            n8n 파이프라인
          </p>
        )}
        <div className="mt-1 space-y-1">{N8N_PROJECTS.map(renderItem)}</div>
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
