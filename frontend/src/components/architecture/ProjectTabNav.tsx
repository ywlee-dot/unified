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
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #F0F1F4',
      }}
    >
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {PIPELINE_ORDER.map((slug) => {
          const pipeline = PROJECT_PIPELINES[slug];
          if (!pipeline) return null;
          const isActive = activeSlug === slug;
          return (
            <button
              key={slug}
              onClick={() => onTabChange(slug)}
              className={clsx(
                "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors duration-150",
                isActive
                  ? "border-[#0064FF] font-semibold"
                  : "border-transparent font-medium hover:border-transparent"
              )}
              style={
                isActive
                  ? { color: '#0064FF' }
                  : undefined
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.color = '#4E5968';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.color = '';
                }
              }}
            >
              <span style={!isActive ? { color: '#8B95A1' } : undefined}>
                {pipeline.name}
              </span>
              <span
                className="rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold"
                style={
                  pipeline.projectType === "standard"
                    ? { backgroundColor: '#E8F1FF', color: '#0064FF' }
                    : { backgroundColor: '#FFF5E6', color: '#FF8800' }
                }
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
