import type {
  Project,
  N8nTriggerResponse,
  N8nRun,
  PaginatedResponse,
  ApiResponse,
} from "./types";

const API_BASE =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || "http://backend:8000/api"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new ApiError(
        errorBody?.error || `Request failed: ${res.status}`,
        res.status,
        errorBody
      );
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async delete(path: string): Promise<void> {
    return this.request<void>(path, { method: "DELETE" });
  }

  // --- Registry ---

  getProjects(): Promise<ApiResponse<Project[]>> {
    return this.get<ApiResponse<Project[]>>("/registry/projects");
  }

  getProject(slug: string): Promise<ApiResponse<Project>> {
    return this.get<ApiResponse<Project>>(`/registry/projects/${slug}`);
  }

  // --- Project Data ---

  getProjectData<T>(slug: string, endpoint: string): Promise<T> {
    return this.get<T>(`/projects/${slug}/${endpoint}`);
  }

  getProjectPaginatedData<T>(
    slug: string,
    endpoint: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResponse<T>> {
    return this.get<PaginatedResponse<T>>(
      `/projects/${slug}/${endpoint}?page=${page}&page_size=${pageSize}`
    );
  }

  // --- n8n ---

  triggerN8nWorkflow(
    slug: string,
    workflowId: string,
    params: Record<string, string> = {}
  ): Promise<N8nTriggerResponse> {
    return this.post<N8nTriggerResponse>(
      `/projects/${slug}/trigger/${workflowId}`,
      { parameters: params }
    );
  }

  getN8nRunStatus(slug: string, runId: string): Promise<N8nRun> {
    return this.get<N8nRun>(`/projects/${slug}/runs/${runId}`);
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export const api = new ApiClient(API_BASE);
