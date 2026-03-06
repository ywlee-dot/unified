"use client";

import { clsx } from "clsx";
import {
  PIPELINE_ORDER,
  PROJECT_PIPELINES,
} from "@/lib/pipeline-data";

interface Props {
  activeSlug: string;
  onTabChange: (slug: string) => void;
}

export default function ProjectTabNav({ activeSlug, onTabChange }: Props) {
  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex gap-1 overflow-x-auto px-1">
        {PIPELINE_ORDER.map((slug) => {
          const pipeline = PROJECT_PIPELINES[slug];
          if (!pipeline) return null;
          const isActive = activeSlug === slug;
          return (
            <button
              key={slug}
              onClick={() => onTabChange(slug)}
              className={clsx(
                "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              <span>{pipeline.name}</span>
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  pipeline.projectType === "standard"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-orange-100 text-orange-600"
                )}
              >
                {pipeline.projectType}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
