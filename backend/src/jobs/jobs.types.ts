export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "delayed";

export interface Job {
  id: string;
  status: JobStatus;
  payload: unknown;
  type: string;
  attempts: number;
  createdAt: Date;
  availableAt?: Date;
}
