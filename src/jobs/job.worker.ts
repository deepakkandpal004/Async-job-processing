import { prisma } from "../config/prisma";
import { executeJobEffect } from "./job-effect.service";
import { BASE_RETRY_DELAY, MAX_CONCURRENCY, WORKER_ID } from "./job.constants";
import { startHeartbeat } from "./job.heartbeat";
import { startRecovery } from "./job.recovery";
import { claimNextJob, completeJob } from "./job.repository";

let activeJobs = 0;

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

  const attempt = job.attempts;

  console.log(
    `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
      `Processing Job ${job.id} | ` +
      `Attempt: ${attempt} | ` +
      `Lease Until: ${job.leaseUntil?.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} | ` +
      `Active Jobs: ${activeJobs}`,
  );

  // const stopHeartbeat = startHeartbeat(job.id);
  try {
    await sleep(15000);

    const effectResult = await executeJobEffect(
      job.idempotentKey,
      job.id,
      job.type,
    );

    if (process.env.CRASH_AFTER_EFFECT === "true") {
      console.log(`[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` + `💥Simulating work Crash after side effect | Job: ${job.id}`);
      process.exit(1);
    }

    const result = await completeJob(job.id);

    if (result.count === 0) {
      throw new Error(`Job ${job.id} is no longer owned by worker ${WORKER_ID}`);
    }
    console.log(`[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` + `Completed Job ${job.id}`);
  } catch (error) {
    console.log(`[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` + `Job ${job.id} failed on attempt ${attempt}`);

    if (attempt < job.maxAttempts) {
      const delay = calculateRetryDelay(attempt);

      const availableAt = new Date(Date.now() + delay);
      await prisma.job.update({
        where: {
          id: job.id,
        },
        data: {
          status: "QUEUED",
          availableAt,
          leaseUntil: null,
          workerId: null,
        },
      });
      console.log(
        `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
          `Job ${job.id} delayed for ${delay}ms`,
      );
    } else {
      await prisma.job.update({
        where: {
          id: job.id,
        },
        data: {
          status: "FAILED",
          leaseUntil: null,
          workerId: null,
        },
      });
      console.log(
        `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
          `Job ${job.id} permanently failed`,
      );
    }
  } finally {
    // stopHeartbeat();
    activeJobs--;
    console.log(
      `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
        `Worker freed | Active Jobs: ${activeJobs}`,
    );
  }
}

async function workerLoop() {
  while (true) {
    if (activeJobs >= MAX_CONCURRENCY) {
      await sleep(100);
      continue;
    }
    const job = await claimNextJob();
    if (!job) {
      await sleep(100);
      continue;
    }
    processJob(job).catch((error) => {
      console.error(`Unexpected error while processing Job ${job.id}:`, error);
    });
  }
}
export function startWorker() {
  workerLoop().catch((error) => {
    console.log("Worker Crashed:", error);
  });
  startRecovery();

  console.log(
    "Node:",
    new Date().toLocaleTimeString(),
  );
  console.log(`worker started with concurrency ${MAX_CONCURRENCY}`);
}
