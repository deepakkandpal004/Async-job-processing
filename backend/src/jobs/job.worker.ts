import { prisma } from "../config/prisma";
import { executeJobEffect } from "./job-effect.service";
import {
  BASE_RETRY_DELAY,
  MAX_CONCURRENCY,
  MAX_RETRY_DELAY,
  WORKER_ID,
} from "./job.constants";
import { startHeartbeat } from "./job.heartbeat";
import { startRecovery } from "./job.recovery";
import {
  claimNextJob,
  completeJob,
  failJob,
  retryJob,
  deadLetterJob,
} from "./job.repository";
import { classifyJobError } from "./job.errors";
import { logger } from "../config/logger";
import { createJobAttempt, finishJobAttempt } from "./job.attempt.repository";
import {
  activeJobsGauge,
  jobProcessingDuration,
  jobQueueWaitDuration,
} from "./worker.metrics";

let activeJobs = 0;
let isShuttingDown = false;

const ENABLE_HEARTBEAT = process.env.ENABLE_HEARTBEAT !== "false";

const runningJobs = new Set<Promise<void>>();
let stopRecovery: (() => void) | null = null;

function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = BASE_RETRY_DELAY * 2 ** (attempt - 1);

  const cappedDelay = Math.min(exponentialDelay, MAX_RETRY_DELAY);

  const jitter = Math.random() * cappedDelay * 0.2;

  return Math.floor(Math.min(cappedDelay + jitter, MAX_RETRY_DELAY));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recordProcessingDuration(jobType: string, startedAt: Date) {
  const processingDurationSeconds = (Date.now() - startedAt.getTime()) / 1000;

  jobProcessingDuration.observe(
    { job_type: jobType },
    processingDurationSeconds,
  );
}

async function processJob(
  job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>,
) {
  activeJobs++;
  activeJobsGauge.set({ worker_id: WORKER_ID }, activeJobs);

  let ownershipLost = false;
  const attempt = job.attempts;
  const startedAt = new Date();

  const jobAttempt = await createJobAttempt(
    job.id,
    job.type,
    WORKER_ID,
    job.fencingToken,
    attempt,
  );

  logger.info(
    {
      event: "Job Processing",
      jobId: job.id,
      workerId: WORKER_ID,
      attempt: attempt,
      leaseUntil: job.leaseUntil,
      fencingToken: job.fencingToken,
      activeJobs: activeJobs,
      priority: job.priority,
    },
    "Processing Job",
  );

  const disableHeartbeatForTest =
    job.type === "FENCING_TEST" && process.env.FENCING_TEST === "true";

  const stopHeartbeat =
    ENABLE_HEARTBEAT && !disableHeartbeatForTest
      ? startHeartbeat(job.id, job.type, job.fencingToken, WORKER_ID, () => {
          ownershipLost = true;
        })
      : () => {};

  try {
    await sleep(20000);

    if (ownershipLost) {
      logger.warn(
        {
          event: "Job OwnerShip Lost",
          jobId: job.id,
          workerId: WORKER_ID,
          fencingToken: job.fencingToken,
          attempt: attempt,
        },
        "Stopping Job Because ownerShip is lost",
      );
      return;
    }

    await executeJobEffect(job.idempotentKey, job.id, job.type);

    if (process.env.CRASH_AFTER_EFFECT === "true") {
      logger.error(
        {
          event: "Working Crash Simulation",
          jobId: job.id,
          workerId: WORKER_ID,
        },
        "Simulating worker crash after side effect",
      );
      process.exit(1);
    }

    if (ownershipLost) {
      logger.warn(
        {
          event: "Job OwnerShip Lost",
          jobId: job.id,
          workerId: WORKER_ID,
          fencingToken: job.fencingToken,
          attempt,
        },
        "Stopping job because worker lost ownership",
      );
      return;
    }

    const result = await completeJob(job.id, job.fencingToken);

    if (result.count === 0) {
      throw new Error(
        `Job ${job.id} is no longer owned by worker ${WORKER_ID}`,
      );
    }

    await finishJobAttempt(jobAttempt.id, "COMPLETED", startedAt);

    recordProcessingDuration(job.type, startedAt);

    logger.info(
      {
        event: "Job Completed",
        jobId: job.id,
        workerId: WORKER_ID,
        fencingToken: job.fencingToken,
        attempt: attempt,
      },
      "Job Completed",
    );
  } catch (error) {
    if (ownershipLost) {
      logger.warn(
        {
          event: "Job OwnerShip Lost",
          jobId: job.id,
          workerId: WORKER_ID,
          fencingToken: job.fencingToken,
          attempt,
        },
        "Stopping job because worker lost ownership",
      );
      return;
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown Error";
    const errorType = classifyJobError(error);

    logger.error(
      {
        event: "Job Failed",
        jobId: job.id,
        workerId: WORKER_ID,
        fencingToken: job.fencingToken,
        attempt,
        error: errorMessage,
      },
      "Job Processing Failed",
    );

    if (errorType === "PERMANENT") {
      const result = await failJob(job.id, job.fencingToken);

      if (result.count === 0) {
        logger.warn(
          {
            event: "Job Failure Rejected",
            jobId: job.id,
            workerId: WORKER_ID,
            fencingToken: job.fencingToken,
          },
          "Permanent Job Failure Rejected - worker no longer owns job",
        );
        return;
      }
      await finishJobAttempt(jobAttempt.id, "FAILED", startedAt, errorMessage);

      recordProcessingDuration(job.type, startedAt);

      logger.error(
        {
          event: "Job Failed Permanently",
          jobId: job.id,
          workerId: WORKER_ID,
          fencingToken: job.fencingToken,
          attempt,
          error: errorMessage,
        },
        "Job Permanently Failed",
      );
      return;
    }

    if (errorType === "UNKNOWN") {
      const result = await failJob(job.id, job.fencingToken);

      if (result.count === 0) {
        logger.warn(
          {
            event: "Job Failure Rejected",
            jobId: job.id,
            workerId: WORKER_ID,
            fencingToken: job.fencingToken,
          },
          "Failure rejected - worker no longer owns job",
        );
        return;
      }
      await finishJobAttempt(jobAttempt.id, "FAILED", startedAt, errorMessage);
      recordProcessingDuration(job.type, startedAt);
      logger.error(
        {
          event: "Job Failed Permanently",
          jobId: job.id,
          workerId: WORKER_ID,
          fencingToken: job.fencingToken,
          attempt,
          error: errorMessage,
        },
        "Unknown Error - Job Permanently Failed",
      );

      return;
    }

    if (attempt < job.maxAttempts) {
      const delay = calculateRetryDelay(attempt);

      const availableAt = new Date(Date.now() + delay);

      const result = await retryJob(job.id, job.fencingToken, availableAt);

      if (result.count === 0) {
        logger.warn(
          {
            event: "Job Retry Rejected",
            jobId: job.id,
            workerId: WORKER_ID,
            fencingToken: job.fencingToken,
            attempt,
          },
          "Retry rejected - worker no longer owns job",
        );
        return;
      }
      await finishJobAttempt(jobAttempt.id, "RETRIED", startedAt, errorMessage);
      recordProcessingDuration(job.type, startedAt);
      logger.info(
        {
          event: "Job Retry Scheduled",
          jobId: job.id,
          workerId: WORKER_ID,
          fencingToken: job.fencingToken,
          attempt,
          delay,
          availableAt,
        },
        "Job retry scheduled",
      );
    } else {
      const result = await deadLetterJob(
        job.id,
        job.fencingToken,
        errorMessage,
      );

      if (result.count === 0) {
        logger.warn(
          {
            event: "Job Dead Rejected",
            jobId: job.id,
            workerId: WORKER_ID,
            fencingToken: job.fencingToken,
            attempt,
          },
          "Job could not be moved to DLQ - worker no longer owns job",
        );
        return;
      }
      await finishJobAttempt(jobAttempt.id, "DEAD", startedAt, errorMessage);
      recordProcessingDuration(job.type, startedAt);
      logger.info(
        {
          event: "Job Dead ",
          jobId: job.id,
          workerId: WORKER_ID,
          fencingToken: job.fencingToken,
          attempt,
          error: errorMessage,
        },
        "Job moved to DEAD",
      );
    }
  } finally {
    stopHeartbeat();

    activeJobs--;
    activeJobsGauge.set({ worker_id: WORKER_ID }, activeJobs);

    logger.info(
      {
        event: "Worker Job Freed",
        jobId: job.id,
        workerId: WORKER_ID,
        activeJobs: activeJobs,
      },
      "Worker freed",
    );
  }
}

async function workerLoop() {
  while (!isShuttingDown) {
    if (activeJobs >= MAX_CONCURRENCY) {
      await sleep(100);
      continue;
    }
    const job = await claimNextJob();

    if (!job) {
      await sleep(100);
      continue;
    }
    const claimedAt = Date.now();

    const queueWaitDurationSeconds =
      (claimedAt - job.availableAt.getTime()) / 1000;
    jobQueueWaitDuration.observe(
      { job_type: job.type },
      queueWaitDurationSeconds,
    );

    const jobPromise = processJob(job);

    runningJobs.add(jobPromise);

    jobPromise
      .catch((error) => {
        logger.error(
          {
            event: "Worker Unexpected Error",
            jobId: job.id,
            workerId: WORKER_ID,
            error: error instanceof Error ? error.message : String(error),
          },
          "Unexpected error while processing job",
        );
      })
      .finally(() => {
        runningJobs.delete(jobPromise);
      });
  }
  logger.info(
    {
      event: "Worker Stopped accepting new jobs",
      workerId: WORKER_ID,
    },
    "Worker stopped accepting new jobs",
  );
}

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(
    {
      event: "Worker Shutdown startd",
      workerId: WORKER_ID,
      signal,
      activeJobs,
    },
    "Worker shutdown",
  );

  if (stopRecovery) {
    stopRecovery();
    stopRecovery = null;
  }

  logger.info(
    {
      event: "Worker Stopped accepting new jobs",
      workerId: WORKER_ID,
      signal,
      activeJobs,
    },
    "Worker stopped accepting new jobs",
  );

  logger.info(
    {
      event: "Worker waiting for active jobs to finish",
      workerId: WORKER_ID,
      signal,
      activeJobs: runningJobs.size,
    },
    "Worker waiting for active jobs to finish",
  );

  await Promise.allSettled(Array.from(runningJobs));

  logger.info(
    {
      event: "Worker Job Finished",
      workerId: WORKER_ID,
      signal,
      activeJobs: runningJobs.size,
    },
    "Worker job finished",
  );

  await prisma.$disconnect();

  logger.info(
    {
      event: "Worker Shutdown Complete",
      workerId: WORKER_ID,
      signal,
      activeJobs: runningJobs.size,
    },
    "Worker shutdown complete",
  );

  process.exit(0);
}

export function startWorker() {
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  workerLoop().catch((error) => {
    logger.error(
      {
        event: "Worker Crashed",
        workerId: WORKER_ID,
        error: error instanceof Error ? error.message : String(error),
      },
      "Worker crashed",
    );
  });

  stopRecovery = startRecovery();

  logger.info(
    {
      event: "Worker Started",
      workerId: WORKER_ID,
      concurrency: MAX_CONCURRENCY,
    },
    "Worker started",
  );
}
