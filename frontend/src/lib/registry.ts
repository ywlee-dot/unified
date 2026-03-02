export interface ProjectConfig {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  type: "standard" | "n8n";
  basePath: string;
  navItems: NavItem[];
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export const PROJECT_NAV_MAP: Record<string, NavItem[]> = {
  "data-collector": [
    { label: "수집 작업", path: "/projects/data-collector/jobs", icon: "list" },
    {
      label: "수집 이력",
      path: "/projects/data-collector/history",
      icon: "clock",
    },
  ],
  analytics: [
    { label: "차트", path: "/projects/analytics/charts", icon: "bar-chart-2" },
    {
      label: "리포트",
      path: "/projects/analytics/reports",
      icon: "file-text",
    },
  ],
  notifications: [
    {
      label: "템플릿",
      path: "/projects/notifications/templates",
      icon: "layout-template",
    },
    {
      label: "발송 이력",
      path: "/projects/notifications/history",
      icon: "clock",
    },
  ],
  "content-manager": [
    {
      label: "콘텐츠 편집",
      path: "/projects/content-manager/editor",
      icon: "edit",
    },
    {
      label: "카테고리",
      path: "/projects/content-manager/categories",
      icon: "folder",
    },
  ],
  "report-generator": [
    {
      label: "생성 결과",
      path: "/projects/report-generator/results",
      icon: "file-check",
    },
  ],
  "data-pipeline": [
    {
      label: "실행 이력",
      path: "/projects/data-pipeline/runs",
      icon: "history",
    },
  ],
};

export function getProjectNavItems(slug: string): NavItem[] {
  return PROJECT_NAV_MAP[slug] || [];
}
