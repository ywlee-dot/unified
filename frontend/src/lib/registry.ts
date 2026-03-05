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
  "dataset-summary": [
    {
      label: "생성 결과",
      path: "/projects/dataset-summary/results",
      icon: "file-check",
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
  "gov-news-crawler": [
    {
      label: "키워드",
      path: "/projects/gov-news-crawler/keywords",
      icon: "tag",
    },
    {
      label: "검색",
      path: "/projects/gov-news-crawler/search",
      icon: "search",
    },
  ],
  "open-data-analyzer": [],
  "evaluation-rag": [],
  summarize: [],
};

export function getProjectNavItems(slug: string): NavItem[] {
  return PROJECT_NAV_MAP[slug] || [];
}
