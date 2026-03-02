"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useProjectData<T>(slug: string, endpoint: string) {
  const query = useQuery({
    queryKey: ["project-data", slug, endpoint],
    queryFn: () => api.getProjectData<T>(slug, endpoint),
    enabled: !!slug && !!endpoint,
    staleTime: 30_000,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useProjectPaginatedData<T>(
  slug: string,
  endpoint: string,
  page: number = 1,
  pageSize: number = 20
) {
  const query = useQuery({
    queryKey: ["project-data", slug, endpoint, page, pageSize],
    queryFn: () => api.getProjectPaginatedData<T>(slug, endpoint, page, pageSize),
    enabled: !!slug && !!endpoint,
    staleTime: 30_000,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
