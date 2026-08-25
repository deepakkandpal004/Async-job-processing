export const MAX_CONCURRENCY = 3;

export const MAX_ATTEMPTS = 3;

export const BASE_RETRY_DELAY = 1000;

export const LEASE_DURATION = 10_000;

export const HEARTBEAT_INTERVAL = 5000;

export const MAX_RETRY_DELAY = 60 *1000;

export const WORKER_ID = `worker-${process.pid}`;

export const WORKER_METRICS_PORT = Number(
  process.env.WORKER_METRICS_PORT ?? 3001,
);
