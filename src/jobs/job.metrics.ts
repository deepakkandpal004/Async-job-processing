import client from "prom-client";
import { prisma } from "../config/prisma";
import { MAX_CONCURRENCY, WORKER_ID } from "./job.constants";

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
});
export const workerMaxConcurrency = new client.Gauge({
  name: "worker_max_concurrency",
  help: "Maximum number of concurrent jobs a worker can process",
  labelNames: ["worker_id"],
  registers: [register],
});
workerMaxConcurrency.set({ worker_id: WORKER_ID }, MAX_CONCURRENCY,);

export const jobsProcessed = new client.Gauge({
  name: "jobs_processed_total",
  help: "Total number of jobs processed by workers",
  labelNames: ["job_type"],
  registers: [register],
});

export const jobsSuccessful = new client.Gauge({
  name: "jobs_successful_total",
  help: "Total number of successful completed jobs",
  labelNames: ["job_type"],
  registers: [register],
});

export const jobsFailed = new client.Gauge({
  name: "jobs_failed_total",
  help: "Total number of permanently failed jobs",
  labelNames: ["job_type"],
  registers: [register],
});

export const jobsRetried = new client.Gauge({
  name: "jobs_retried_total",
  help: "Total number of scheduled jobs retried",
  labelNames: ["job_type"],
  registers: [register],
});

export const jobsDead = new client.Gauge({
  name: "jobs_dead_total",
  help: "Total number of jobs moved to DEAD",
  labelNames: ["job_type"],
  registers: [register],
});

export const jobsRecovered = new client.Gauge({
  name: "jobs_recovered_total",
  help: "Total number of stale jobs recovered by workers",
  labelNames: ["job_type"],
  registers: [register],
});

export const activeJobsGauge = new client.Gauge({
  name: "active_jobs",
  help: "Number of jobs currently being processed by workers",
  labelNames: ["worker_id"],
  registers: [register],
});

export const queueDepth = new client.Gauge({
  name: "queue_depth",
  help: "Number of jobs currently waiting in the queue",
  registers: [register],
});

export const jobDurationBucket = new client.Gauge({
  name: "job_processing_duration_seconds_bucket",
  help: "Number of job attempts completed within processing duration buckets",
  labelNames: ["job_type", "le"],
  registers: [register],
});

export const jobDurationSum = new client.Gauge({
  name: "job_processing_duration_seconds_sum",
  help: "Total processing duration of job attempts in seconds",
  labelNames: ["job_type"],
  registers: [register],
});

export const jobDurationCount = new client.Gauge({
  name: "job_processing_duration_seconds_count",
  help: "Total number of job attempts with recorded processing duration",
  labelNames: ["job_type"],
  registers: [register],
});


const DURATION_BUCKETS = [0.1, 0.5, 1, 5, 10, 20, 30, 60, Infinity];

export const updateSystemMetrics = async () => {
  const queued = await prisma.job.count({ where: { status: "QUEUED" } });
  queueDepth.set(queued);

  const attempts = await prisma.jobAttempt.findMany({
    select: {
      jobType: true,
      duration: true,
      status: true,
    },
  });

  jobsProcessed.reset();
  jobsSuccessful.reset();
  jobsFailed.reset();
  jobsRetried.reset();
  jobsDead.reset();
  jobsRecovered.reset();

  jobDurationBucket.reset();
  jobDurationSum.reset();
  jobDurationCount.reset();

  const grouped = new Map<
    string,
    {
      processed: number;
      successful: number;
      failed: number;
      retried: number;
      recovered: number;
      dead: number;
      durations: number[];
    }
  >();

  for (const attempt of attempts) {
    if (!grouped.has(attempt.jobType)) {
      grouped.set(attempt.jobType, {
        processed: 0,
        successful: 0,
        failed: 0,
        retried: 0,
        recovered: 0,
        dead: 0,
        durations: [],
      });
    }
    const metrics = grouped.get(attempt.jobType)!;
    metrics.processed++;

    switch (attempt.status) {
      case "COMPLETED":
        metrics.successful++;
        break;
      case "FAILED":
        metrics.failed++;
        break;
      case "RETRIED":
        metrics.retried++;
        break;
      case "RECOVERED":
        metrics.recovered++;
        break;
      case "DEAD":
        metrics.dead++;
        break;
    }
    if (attempt.duration !== null) {
      metrics.durations.push(attempt.duration / 1000);
    }
  }

  grouped.forEach((metrics, jobType) => {
    jobsProcessed.set({ job_type: jobType }, metrics.processed);
    jobsSuccessful.set({ job_type: jobType }, metrics.successful);
    jobsFailed.set({ job_type: jobType }, metrics.failed);
    jobsRetried.set({ job_type: jobType }, metrics.retried);
    jobsRecovered.set({ job_type: jobType }, metrics.recovered);
    jobsDead.set({ job_type: jobType }, metrics.dead);

    const bucketCounts = DURATION_BUCKETS.map(() => 0);

    let durationSum = 0;
    for (const duration of metrics.durations) {
      durationSum += duration;

      for (let i = 0; i < DURATION_BUCKETS.length; i++) {
        if (duration <= DURATION_BUCKETS[i]) {
          bucketCounts[i]++;
        }
      }
    }

    for (let i = 0; i < DURATION_BUCKETS.length; i++) {
      const bucket = DURATION_BUCKETS[i];

      const label = bucket === Infinity ? "+Inf" : String(bucket);

      jobDurationBucket.set({ job_type: jobType, le: label, }, bucketCounts[i]);
    }
    jobDurationSum.set({ job_type: jobType }, durationSum);

    jobDurationCount.set({ job_type: jobType }, metrics.durations.length);
  });
};

export async function getMetrics() {
  await updateSystemMetrics();
  return register.metrics();
}

export function getMetricsContentType() {
  return register.contentType;
}
