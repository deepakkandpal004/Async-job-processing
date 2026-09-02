import client from "prom-client";
import { MAX_CONCURRENCY, WORKER_ID } from "./job.constants";

export const workerRegistry = new client.Registry();

client.collectDefaultMetrics({
  register: workerRegistry,
});

export const workerMaxConcurrency = new client.Gauge({
  name: "worker_max_concurrency",
  help: "Maximum number of concurrent jobs a worker can process",
  labelNames: ["worker_id"],
  registers: [workerRegistry],
});

workerMaxConcurrency.set(
  { worker_id: WORKER_ID },
  MAX_CONCURRENCY,
);

export const activeJobsGauge = new client.Gauge({
  name: "active_jobs",
  help: "Number of jobs currently being processed by a worker",
  labelNames: ["worker_id"],
  registers: [workerRegistry],
});

activeJobsGauge.set(
  { worker_id: WORKER_ID },
  0,
);

export const heartbeatRenewals = new client.Counter({
  name: "job_heartbeat_renewals_total",
  help: "Total number of successful heartbeat lease renewals",
  labelNames: ["worker_id", "job_type"],
  registers: [workerRegistry],
});

export const heartbeatFailures = new client.Counter({
  name: "job_heartbeat_failures_total",
  help: "Total number of failed heartbeat lease renewals",
  labelNames: ["worker_id", "job_type"],
  registers: [workerRegistry],
});

export const ownershipLost = new client.Counter({
  name: "job_ownership_lost_total",
  help: "Total number of jobs that lost worker ownership",
  labelNames: ["worker_id", "job_type"],
  registers: [workerRegistry],
});

export async function getWorkerMetrics() {
  return workerRegistry.metrics();
}

export function getWorkerMetricsContentType() {
  return workerRegistry.contentType;
}
