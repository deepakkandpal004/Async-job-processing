import { createJob as createJobRepository } from './job.repository';

interface createJobInput {
  type: string,
  payload: unknown,
  idempotentKey: string,
}

export async function createJob(input: createJobInput) {
  return createJobRepository(
    input.type,
    input.payload,
    input.idempotentKey,
  );
}
