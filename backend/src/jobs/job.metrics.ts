import client from "prom-client";
import { prisma } from "../config/prisma";

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
});

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

export const queueDepth = new client.Gauge({
  name: "queue_depth",
  help: "Number of jobs currently waiting in the queue",
  registers: [register],
});

export const updateSystemMetrics = async () => {
  const queued = await prisma.job.count({
    where: {
      status: "QUEUED",
    },
  });

  queueDepth.set(queued);

  const attempts = await prisma.jobAttempt.findMany({
    select: {
      jobType: true,
      status: true,
    },
  });

  jobsProcessed.reset();
  jobsSuccessful.reset();
  jobsFailed.reset();
  jobsRetried.reset();
  jobsRecovered.reset();
  jobsDead.reset();

  const grouped = new Map<
    string,
    {
      processed: number;
      successful: number;
      failed: number;
      retried: number;
      recovered: number;
      dead: number;
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
  }

  grouped.forEach((metrics, jobType) => {
    jobsProcessed.set(
      { job_type: jobType },
      metrics.processed,
    );

    jobsSuccessful.set(
      { job_type: jobType },
      metrics.successful,
    );

    jobsFailed.set(
      { job_type: jobType },
      metrics.failed,
    );

    jobsRetried.set(
      { job_type: jobType },
      metrics.retried,
    );

    jobsRecovered.set(
      { job_type: jobType },
      metrics.recovered,
    );

    jobsDead.set(
      { job_type: jobType },
      metrics.dead,
    );
  });
};

export async function getMetrics() {
  await updateSystemMetrics();

  return register.metrics();
}

export function getMetricsContentType() {
  return register.contentType;
}
