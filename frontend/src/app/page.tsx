"use client";

import { useProjects } from "@/hooks/useProjects";
import ProjectCard from "@/components/layout/ProjectCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

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
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
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
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
      <p className="mt-1 text-sm text-gray-500">
        전체 프로젝트 현황을 확인하세요
      </p>

      {/* Standard Projects */}
      {standardProjects.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            프로젝트
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {standardProjects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* n8n Projects */}
      {n8nProjects.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            n8n 파이프라인
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {n8nProjects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
