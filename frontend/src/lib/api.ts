import type {
  Project,
  N8nTriggerResponse,
  N8nRun,
  PaginatedResponse,
  ApiResponse,
  LoginResponse,
} from "./types";

const API_BASE =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || "http://backend:8000/api"
    : "/api";

class ApiClient {
  private baseUrl: string;
  private _refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * SSR cookie forwarding: reads access_token cookie from incoming request
   * and forwards it to the backend. Only active server-side.
   * RECOMMENDED (future-proofing): All current pages are "use client".
   */
  private async getSSRHeaders(): Promise<HeadersInit> {
    if (typeof window !== "undefined") return {};
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const token = cookieStore.get("access_token")?.value;
      if (token) {
        return { Cookie: `access_token=${token}` };
      }
    } catch {
      // next/headers not available outside request context
    }
    return {};
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const ssrHeaders = await this.getSSRHeaders();
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...ssrHeaders,
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        // Try refresh token before redirecting to login
        const refreshed = await this._tryRefresh();
        if (refreshed) {
          // Retry original request once after successful refresh
          const retryRes = await fetch(url, {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...options.headers,
            },
            ...options,
          });
          if (retryRes.ok) {
            return retryRes.status === 204 ? (undefined as T) : retryRes.json();
          }
        }
        window.location.href = "/login";
        throw new ApiError("인증이 필요합니다", 401);
      }
      const errorBody = await res.json().catch(() => null);
      throw new ApiError(
        errorBody?.detail || errorBody?.error || `Request failed: ${res.status}`,
        res.status,
        errorBody
      );
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json();
  }

  private async _tryRefresh(): Promise<boolean> {
    // Deduplicate concurrent refresh calls
    if (!this._refreshPromise) {
      this._refreshPromise = (async () => {
        try {
          const res = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });
          return res.ok;
        } catch {
          return false;
        } finally {
          this._refreshPromise = null;
        }
      })();
    }
    return this._refreshPromise;
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

  // --- Auth ---

  login(email: string, password: string): Promise<LoginResponse> {
    return this.post<LoginResponse>("/auth/login", { email, password });
  }

  async logout(): Promise<void> {
    return this.request<void>("/auth/logout", { method: "POST" });
  }

  async refresh(): Promise<LoginResponse> {
    const res = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      throw new ApiError("Refresh failed", res.status);
    }
    return res.json();
  }

  async getMe(): Promise<LoginResponse> {
    const url = `${this.baseUrl}/auth/me`;
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new ApiError("Not authenticated", res.status);
    }
    return res.json();
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

  // --- Form Data ---

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const ssrHeaders = await this.getSSRHeaders();
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: formData,
      headers: {
        ...ssrHeaders,
      },
    });

    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        window.location.href = "/login";
        throw new ApiError("인증이 필요합니다", 401);
      }
      const errorBody = await res.json().catch(() => null);
      throw new ApiError(
        errorBody?.detail || errorBody?.error || `Request failed: ${res.status}`,
        res.status,
        errorBody
      );
    }

    return res.json();
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
