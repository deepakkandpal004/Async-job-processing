import client from "prom-client"

export const workerRegistry = new client.Registry();

client.collectDefaultMetrics({ register: workerRegistry });

export const heartbeatRenewals = new client.Counter({
  name: "job_heartbeat_renewals_total",
  help: "Total number of successful heartbeat lease renewals",
  labelNames: ["job_type"],
  registers: [workerRegistry],
});

export const heartbeatFailures = new client.Counter({
  name: "job_heartbeat_failures_total",
  help: "Total number of failed heartbeat lease renewals",
  labelNames: ["job_type"],
  registers: [workerRegistry],
});

export const ownershipLost = new client.Counter({
  name: "job_ownership_lost_total",
  help: "Total number of jobs that lost worker ownership",
  labelNames: ["job_type"],
  registers: [workerRegistry],
});

export async function getWorkerMetrics() {
  return workerRegistry.metrics();
}

export function getWorkerMetricsContentType() {
  return workerRegistry.contentType;
}
