"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  UNIFIED_DIAGRAMS,
  ARCH_TYPE_LABELS,
  PROJECT_HIGHLIGHTS,
  type ArchType,
} from "@/lib/architecture-data";
import { useProjects } from "@/hooks/useProjects";
import ArchitectureTabNav from "@/components/architecture/ArchitectureTabNav";
import ArchitectureDiagram from "@/components/architecture/ArchitectureDiagram";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

export default function ProjectArchitecturePage() {
  const { slug } = useParams<{ slug: string }>();
  const { projects, isLoading, error } = useProjects();
  const [activeTab, setActiveTab] = useState<ArchType>("system");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">데이터를 불러올 수 없습니다.</p>
        <Link href="/architecture" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          아키텍처 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg font-medium text-slate-700">프로젝트를 찾을 수 없습니다</p>
        <p className="mt-1 text-sm text-slate-500">
          &quot;{slug}&quot; 에 해당하는 프로젝트가 없습니다.
        </p>
        <Link href="/architecture" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          아키텍처 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const diagram = UNIFIED_DIAGRAMS[activeTab];
  const meta = ARCH_TYPE_LABELS[activeTab];
  const highlights = PROJECT_HIGHLIGHTS[slug];
  const highlightNodeIds = highlights?.highlightNodes[activeTab] ?? undefined;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            {project.name}
          </h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {project.project_type}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          프로젝트별 아키텍처 — 관련 구성요소가 하이라이트됩니다
        </p>
      </div>

      <ArchitectureTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{diagram.title}</h2>
          <p className="text-sm text-slate-500">{meta.description}</p>
        </div>
        <ArchitectureDiagram
          diagram={diagram}
          highlightNodeIds={highlightNodeIds}
        />
      </div>
    </div>
  );
}
