"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  PROJECT_PIPELINES,
  PIPELINE_ORDER,
} from "@/lib/pipeline-data";
import ProjectTabNav from "@/components/architecture/ProjectTabNav";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { BranchingPipeline } from "@/components/architecture/BranchingPipeline";

const PipelineFlow = dynamic(
  () => import("@/components/architecture/PipelineFlow"),
  { ssr: false, loading: () => <div className="flex h-[600px] items-center justify-center"><LoadingSpinner /></div> }
);

function ArchitectureContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeSlug = searchParams.get("project") || PIPELINE_ORDER[0];
  const pipeline = PROJECT_PIPELINES[activeSlug];

  const handleTabChange = (slug: string) => {
    router.replace(`/architecture?project=${slug}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-[22px] font-bold leading-tight" style={{ color: '#191F28' }}>
          프로젝트 아키텍처
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#8B95A1' }}>
          프로젝트별 E2E 파이프라인 다이어그램
        </p>
      </div>

      {/* Tab Navigation */}
      <ProjectTabNav activeSlug={activeSlug} onTabChange={handleTabChange} />

      {pipeline ? (
        <div>
          {/* Pipeline description */}
          <div className="mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold" style={{ color: '#191F28' }}>
                {pipeline.name}
              </h2>
              <span
                className="rounded-[6px] px-2 py-0.5 text-[10px] font-semibold"
                style={
                  pipeline.projectType === "standard"
                    ? { backgroundColor: '#E8F1FF', color: '#0064FF' }
                    : { backgroundColor: '#FFF5E6', color: '#FF8800' }
                }
              >
                {pipeline.projectType}
              </span>
            </div>
            <p className="mt-1 text-sm" style={{ color: '#4E5968' }}>
              {pipeline.description}
            </p>
          </div>

          {/* Flow Canvas */}
          {pipeline.pipelineGraph ? (
            <BranchingPipeline
              graph={pipeline.pipelineGraph}
              color={pipeline.color ?? "#3182f6"}
            />
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                minHeight: '600px',
              }}
            >
              <PipelineFlow pipeline={pipeline} />
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex h-[400px] items-center justify-center rounded-2xl"
          style={{
            backgroundColor: '#F4F5F8',
            border: '1px solid #E5E8EB',
          }}
        >
          <div className="text-center">
            <p className="text-base font-semibold" style={{ color: '#191F28' }}>
              파이프라인을 찾을 수 없습니다
            </p>
            <p className="mt-1 text-sm" style={{ color: '#8B95A1' }}>
              &quot;{activeSlug}&quot; 프로젝트의 파이프라인이 정의되지 않았습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><LoadingSpinner /></div>}>
      <ArchitectureContent />
    </Suspense>
  );
}
