import client from "prom-client"

const register = new client.Registry();

client.collectDefaultMetrics({
  register
});

export const jobsProcessed = new client.Counter({
  name: "jobs_processed_total",
  help: "Total number of jobs processed by workers",
  registers: [register],
});

export const jobsSuccessful = new client.Counter({
  name: "jobs_successful_total",
  help: "Total number of successful completed jobs",
  registers: [register],
});

export const jobsFailed = new client.Counter({
  name: "jobs_failed_total",
  help: "Total number of permanently failed jobs",
  registers: [register],
});

export const jobsRetried = new client.Counter({
  name: "jobs_retried_total",
  help: "Total number of scheduled jobs retried",
  registers: [register],
});

export const jobsDead = new client.Counter({
  name: "jobs_dead_total",
  help: "Total number of jobs moved to DEAD",
  registers: [register],
});

export const jobDuration = new client.Histogram({
  name: "job_processing_duration_seconds",
  help: "Time spent processing a job attempt",
  buckets: [
    0.1,
    0.5,
    1,
    5,
    10,
    20,
    30,
    60,
  ],
  registers: [register],
});

export async function getMetrics() {
  return await register.metrics();
}

export function getMetricsContentType() {
  return register.contentType;
}
