export class RetryableJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableJobError';
  }
}

export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

export type JobErrorType =
  | "RETRYABLE"
  | "PERMANENT"
  | "UNKNOWN";

export function classifyJobError(
  error: unknown,
): JobErrorType {
  if (error instanceof RetryableJobError) {
    return "RETRYABLE";
  }

  if (error instanceof PermanentJobError) {
    return "PERMANENT";
  }

  return "UNKNOWN";
}
