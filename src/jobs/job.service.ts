import { createJob as createJobRepository } from './job.repository';

interface createJobInput {
  type: string,
  payload: unknown,
}

export async function createJob(input: createJobInput) {
  return createJobRepository(
    input.type,
    input.payload
  );
}
