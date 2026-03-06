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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          프로젝트 아키텍처
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          프로젝트별 E2E 파이프라인 다이어그램
        </p>
      </div>

      <ProjectTabNav activeSlug={activeSlug} onTabChange={handleTabChange} />

      {pipeline ? (
        <div>
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-800">
                {pipeline.name}
              </h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                pipeline.projectType === "standard"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-orange-100 text-orange-700"
              }`}>
                {pipeline.projectType}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {pipeline.description}
            </p>
          </div>
          <PipelineFlow pipeline={pipeline} />
        </div>
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
          <div className="text-center">
            <p className="text-lg font-medium text-slate-700">
              파이프라인을 찾을 수 없습니다
            </p>
            <p className="mt-1 text-sm text-slate-500">
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
