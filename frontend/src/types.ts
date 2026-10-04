export type JobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "DEAD"
  | "CANCELLED";

export interface Job {
  id: string;
  type: string;
  payload: unknown;
  idempotentKey: string;
  priority: number;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  timeoutMs: number | null;
  lastError: string | null;
  deadAt: string | null;
  availableAt: string;
  leaseUntil: string | null;
  workerId: string | null;
  fencingToken: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateJobInput {
  type: string;
  payload: unknown;
  idempotentKey: string;
  priority: number;
  delay: number;
  timeoutMs?: number;
}

export const STATUSES: JobStatus[] = [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "DEAD",
  "CANCELLED",
];
