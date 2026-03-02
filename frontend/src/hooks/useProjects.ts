"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

export function useProjects() {
  const query = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await api.getProjects();
      return res.data ?? [];
    },
    staleTime: 60_000,
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useProject(slug: string) {
  const query = useQuery({
    queryKey: ["project", slug],
    queryFn: async () => {
      const res = await api.getProject(slug);
      return res.data;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });

  return {
    project: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
