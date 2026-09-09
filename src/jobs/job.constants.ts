import { config } from "../config/env";

export const MAX_CONCURRENCY = config.worker.concurrency;

export const MAX_ATTEMPTS = config.worker.maxAttempts;

export const BASE_RETRY_DELAY = config.worker.baseRetryDelay;

export const LEASE_DURATION = config.worker.leaseDuration;

export const HEARTBEAT_INTERVAL = config.worker.heartbeatInterval;

export const MAX_RETRY_DELAY = config.worker.maxRetryDelay;

export const WORKER_ID = `worker-${process.pid}`;

export const WORKER_METRICS_PORT = config.worker.metricsPort;
