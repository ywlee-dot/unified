import Link from "next/link";
import {
  Database,
  BarChart3,
  Bell,
  FileText,
  GitBranch,
  GitMerge,
  Sparkles,
  ShieldCheck,
  Newspaper,
  ClipboardCheck,
  Workflow,
} from "lucide-react";
import { clsx } from "clsx";
import type { Project } from "@/lib/types";

const ICON_MAP: Record<string, React.ReactNode> = {
  database: <Database className="h-5 w-5" />,
  "bar-chart": <BarChart3 className="h-5 w-5" />,
  bell: <Bell className="h-5 w-5" />,
  "file-text": <FileText className="h-5 w-5" />,
  "git-branch": <GitBranch className="h-5 w-5" />,
  "git-merge": <GitMerge className="h-5 w-5" />,
  sparkles: <Sparkles className="h-5 w-5" />,
  "shield-check": <ShieldCheck className="h-5 w-5" />,
  newspaper: <Newspaper className="h-5 w-5" />,
  "clipboard-check": <ClipboardCheck className="h-5 w-5" />,
  workflow: <Workflow className="h-5 w-5" />,
};

interface ProjectCardProps {
  project: Project;
  metrics?: Record<string, string | number>;
}

export default function ProjectCard({ project, metrics }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className={clsx(
        "group relative block overflow-hidden rounded-xl bg-surface-elevated",
        "border border-border-secondary",
        "transition-all duration-200 ease-toss",
        "hover:shadow-lg hover:border-border-primary"
      )}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `${project.color}12`,
              color: project.color,
            }}
          >
            {ICON_MAP[project.icon] || <Database className="h-5 w-5" />}
          </div>
          {project.project_type === "n8n" && (
            <span className="rounded-sm bg-positive-bg px-2 py-0.5 text-caption-2 font-medium text-positive">
              n8n
            </span>
          )}
        </div>

        {/* Title and description */}
        <h3 className="mt-3 text-title-3 text-text-primary transition-colors duration-150 group-hover:text-brand">
          {project.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-body-2 text-text-secondary">
          {project.description}
        </p>

        {/* Metrics */}
        {metrics && Object.keys(metrics).length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-secondary pt-4">
            {Object.entries(metrics).map(([label, value]) => (
              <div key={label}>
                <p className="text-caption-1 text-text-tertiary">{label}</p>
                <p className="mt-0.5 text-body-1 font-semibold text-text-primary">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
