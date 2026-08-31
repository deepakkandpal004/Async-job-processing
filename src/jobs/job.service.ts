import { createJob as createJobRepository, cancelJob as cancelJobRepository } from './job.repository';

interface createJobInput {
  type: string,
  payload: unknown,
  idempotentKey: string,
  priority?: number,
  availableAt?: Date,
}

export async function createJob(input: createJobInput) {
  return createJobRepository(
    input.type,
    input.payload,
    input.idempotentKey,
    input.priority ?? 0,
    input.availableAt ?? new Date(),
  );
}

export async function cancelJob(jobId: string) {
  return cancelJobRepository(jobId);
}
