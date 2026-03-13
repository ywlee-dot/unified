"use client";

import { useProjects } from "@/hooks/useProjects";
import ProjectCard from "@/components/layout/ProjectCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="h-4 w-[2px] rounded-full bg-brand" />
      <h2 className="text-[15px] font-semibold text-text-primary">{children}</h2>
    </div>
  );
}

export default function DashboardPage() {
  const { projects, isLoading, error } = useProjects();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-negative/20 bg-negative-bg p-6 text-center text-negative">
        프로젝트 목록을 불러오는데 실패했습니다.
      </div>
    );
  }

  if (projects.length === 0) {
    return <EmptyState title="등록된 프로젝트가 없습니다" />;
  }

  const standardProjects = projects.filter((p) => p.project_type === "standard");
  const n8nProjects = projects.filter((p) => p.project_type === "n8n");

  return (
    <div>
      {/* Page header */}
      <h1 className="text-title-1 text-text-primary">대시보드</h1>
      <p className="mb-8 mt-1 text-body-2 text-text-secondary">
        프로젝트 현황을 한눈에 확인하세요
      </p>

      {/* Standard Projects */}
      {standardProjects.length > 0 && (
        <section className="mt-8">
          <SectionTitle>표준 프로젝트</SectionTitle>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {standardProjects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* n8n Projects */}
      {n8nProjects.length > 0 && (
        <section className="mt-8">
          <SectionTitle>n8n 파이프라인</SectionTitle>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {n8nProjects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
