import Link from "next/link";
import {
  Database,
  BarChart3,
  Bell,
  FileText,
  GitBranch,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import type { Project } from "@/lib/types";

const ICON_MAP: Record<string, React.ReactNode> = {
  database: <Database className="h-6 w-6" />,
  "bar-chart": <BarChart3 className="h-6 w-6" />,
  bell: <Bell className="h-6 w-6" />,
  "file-text": <FileText className="h-6 w-6" />,
  "git-branch": <GitBranch className="h-6 w-6" />,
  sparkles: <Sparkles className="h-6 w-6" />,
};

interface ProjectCardProps {
  project: Project;
  metrics?: Record<string, string | number>;
}

export default function ProjectCard({ project, metrics }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Color accent bar */}
      <div className="h-1" style={{ backgroundColor: project.color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div
            className={clsx(
              "flex h-10 w-10 items-center justify-center rounded-lg"
            )}
            style={{
              backgroundColor: `${project.color}15`,
              color: project.color,
            }}
          >
            {ICON_MAP[project.icon] || <Database className="h-6 w-6" />}
          </div>
          {project.project_type === "n8n" && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              n8n
            </span>
          )}
        </div>

        {/* Title and description */}
        <h3 className="mt-3 text-base font-semibold text-gray-900 group-hover:text-primary-600">
          {project.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">
          {project.description}
        </p>

        {/* Metrics */}
        {metrics && Object.keys(metrics).length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(metrics).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
