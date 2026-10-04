import type { CreateJobInput, Job, JobStatus, Pagination } from "./types";

const LS_BASE_URL = "ajp.baseUrl";
const LS_ADMIN_KEY = "ajp.adminKey";

export function getBaseUrl(): string {
  // Empty = same-origin, goes through the Vite dev proxy (no CORS issues).
  return localStorage.getItem(LS_BASE_URL) || "";
}

export function setBaseUrl(url: string) {
  localStorage.setItem(LS_BASE_URL, url);
}

export function getAdminKey(): string {
  return localStorage.getItem(LS_ADMIN_KEY) || "";
}

export function setAdminKey(key: string) {
  localStorage.setItem(LS_ADMIN_KEY, key);
}

function base(): string {
  const raw = getBaseUrl().trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

function displayBase(): string {
  return base() || "vite proxy (→ localhost:3000)";
}

async function request<T>(path: string, init?: RequestInit, admin = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (admin) {
    const key = getAdminKey();
    if (!key) throw new Error("Admin API key missing — set it in the header bar.");
    headers["Authorization"] = `Bearer ${key}`;
  }
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Cannot reach API at ${displayBase()}. Is the backend running?`);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

interface CreateJobResponse {
  success: boolean;
  message: string;
  data: { id: string; status: JobStatus };
}

interface ListJobsResponse {
  success: boolean;
  data: Job[];
  pagination: Pagination;
}

interface DeadJobsResponse {
  success: boolean;
  data: Job[];
}

interface JobResponse {
  success: boolean;
  data: Job;
}

export const api = {
  createJob(input: CreateJobInput): Promise<CreateJobResponse> {
    const { delay, ...rest } = input;
    return request<CreateJobResponse>("/jobs", {
      method: "POST",
      body: JSON.stringify({ ...rest, delay }),
    });
  },

  cancelJob(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/jobs/${id}`, { method: "DELETE" });
  },

  listJobs(params: {
    page: number;
    limit: number;
    status?: string;
    type?: string;
    priority?: number;
  }): Promise<ListJobsResponse> {
    const q = new URLSearchParams();
    q.set("page", String(params.page));
    q.set("limit", String(params.limit));
    if (params.status) q.set("status", params.status);
    if (params.type) q.set("type", params.type);
    if (params.priority !== undefined) q.set("priority", String(params.priority));
    return request<ListJobsResponse>(`/admin/jobs?${q.toString()}`, undefined, true);
  },

  getDeadJobs(): Promise<DeadJobsResponse> {
    return request<DeadJobsResponse>("/admin/jobs/dead", undefined, true);
  },

  getJob(id: string): Promise<JobResponse> {
    return request<JobResponse>(`/admin/jobs/${id}`, undefined, true);
  },

  retryDeadJob(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/admin/jobs/${id}/retry`, { method: "POST" }, true);
  },

  async ping(): Promise<boolean> {
    try {
      await fetch(`${base()}/metrics`, { method: "HEAD" });
      return true;
    } catch {
      return false;
    }
  },
};

export function randomKey(prefix = "job"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
