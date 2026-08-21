import { prisma } from "../config/prisma";
import { executeJobEffect } from "./job-effect.service";
import { BASE_RETRY_DELAY, MAX_CONCURRENCY, WORKER_ID } from "./job.constants";
import { startHeartbeat } from "./job.heartbeat";
import { startRecovery } from "./job.recovery";
import { claimNextJob, completeJob, failJob, retryJob } from "./job.repository";

let activeJobs = 0;
let isShuttingDown = false;
const ENABLE_HEARTBEAT = process.env.ENABLE_HEARTBEAT !== "false";
const runningJobs = new Set<Promise<void>>();
let stopRecovery: () => void;

function calculateRetryDelay(attempt: number): number {
  return BASE_RETRY_DELAY * 2 ** (attempt - 1);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(
  job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>,
) {
  activeJobs++;
  let ownershipLost = false;

  const attempt = job.attempts;

  console.log(
    `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
      `Processing Job ${job.id} | ` +
      `Attempt: ${attempt} | ` +
      `Lease Until: ${job.leaseUntil?.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} | ` +
      `Active Jobs: ${activeJobs}`,
  );

  const stopHeartbeat = ENABLE_HEARTBEAT
    ? startHeartbeat(job.id, job.fencingToken, WORKER_ID, () => {
        ownershipLost = true;
      })
    : () => {};
  try {
    await sleep(10000);

    if (ownershipLost) {
      console.log(
        `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
          `Stopping Job ${job.id} because worker lost ownership`,
      );
      return;
    }

    await executeJobEffect(job.idempotentKey, job.id, job.type);

    if (process.env.CRASH_AFTER_EFFECT === "true") {
      console.log(
        `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}]` +
          `💥 Simulating work Crash after side effect | Job: ${job.id}`,
      );
      process.exit(1);
    }

    if (ownershipLost) {
      console.log(
        `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
          `Stopping Job ${job.id} because worker lost ownership`,
      );
      return;
    }

    const result = await completeJob(job.id, job.fencingToken);

    if (result.count === 0) {
      throw new Error(
        `Job ${job.id} is no longer owned by worker ${WORKER_ID}`,
      );
    }
    console.log(
      `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
        `Completed Job ${job.id}`,
    );
  } catch (error) {
    if (ownershipLost) {
      console.log(
        `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
          `Job ${job.id} ownership lost - skipping retry/failure`,
      );
      return;
    }

    console.log(
      `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
        `Job ${job.id} failed on attempt ${attempt}`,
    );

    if (attempt < job.maxAttempts) {
      const delay = calculateRetryDelay(attempt);

      const availableAt = new Date(Date.now() + delay);
      const result = await retryJob(job.id, job.fencingToken, availableAt);
      if (result.count === 0) {
        console.log(
          `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
            `Job ${job.id} retry rejected - worker no longer owns job ${WORKER_ID}`,
        );
        return;
      }

      console.log(
        `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
          `Job ${job.id} delayed for ${delay}ms`,
      );
    } else {
      const result = await failJob(job.id, job.fencingToken);
      if (result.count === 0) {
        console.log(
          `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
            `Job ${job.id} failure rejected - worker no longer owns job ${WORKER_ID}`,
        );
        return;
      }
      console.log(
        `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
          `Job ${job.id} permanently failed`,
      );
    }
  } finally {
    stopHeartbeat();
    activeJobs--;
    console.log(
      `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
        `Worker freed | Active Jobs: ${activeJobs}`,
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
    const jobPromise = processJob(job);
    runningJobs.add(jobPromise);
    jobPromise
      .catch((error) => {
        console.error(
          `Unexpected error while processing Job ${job.id}:`,
          error,
        );
      })
      .finally(() => {
        runningJobs.delete(jobPromise);
      });
  }
  console.log("Worker stopped accepting new jobs");
}

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] Received ${signal}. Starting graceful shutdown...`);

  if (!stopRecovery) {
    stopRecovery();
    stopRecovery = null;
  }

  console.log(`worker stopped accepting new jobs`)

  console.log(`Waiting for ${runningJobs.size} active jobs to finish...`);

  await Promise.allSettled(Array.from(runningJobs));

  console.log(`All active jobs have finished.`)

  await prisma.$disconnect();

  console.log("Worker shutdown complete.");

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
    console.log("Worker Crashed:", error);
  });

  stopRecovery = startRecovery();

  console.log(`Node: ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`)

  console.log(`worker started with concurrency ${MAX_CONCURRENCY}`);

}
