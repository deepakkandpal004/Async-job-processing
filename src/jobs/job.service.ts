import { createJob as createJobRepository, cancelJob as cancelJobRepository } from './job.repository';

interface createJobInput {
  type: string,
  payload: unknown,
  idempotentKey: string,
  priority?: number,
  availableAt?: Date,
  timeoutMs?: number,
}

export async function createJob(input: createJobInput) {
  return createJobRepository(
    input.type,
    input.payload,
    input.idempotentKey,
    input.priority ?? 0,
    input.availableAt ?? new Date(),
    input.timeoutMs,
  );
}

export async function cancelJob(jobId: string) {
  return cancelJobRepository(jobId);
}
