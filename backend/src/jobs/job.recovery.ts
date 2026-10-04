import { logger } from "../config/logger";
import { prisma } from "../config/prisma";

const RECOVERY_INTERVAL = 3000;

export async function recoverStaleJobs() {
  return prisma.$transaction(async (tx) => {
    const staleJobs = await tx.$queryRaw<
      Array<{
        id: string;
        workerId: string | null;
        leaseUntil: Date | null;
      }>
    >`
    SELECT "id", "workerId", "leaseUntil"
    FROM "Job"
    WHERE "status" = 'PROCESSING'
      AND "leaseUntil" IS NOT NULL
      AND "leaseUntil" < NOW()
      ORDER BY "leaseUntil" ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 10
    `;

    let recoverCount = 0;
    for (const job of staleJobs) {
      const result = await tx.$executeRaw`
        UPDATE "Job"
        SET "status" = 'QUEUED', "workerId" = null, "leaseUntil" = null
        WHERE "id" = ${job.id} AND "status" = 'PROCESSING'
        AND "leaseUntil" IS NOT NULL
        AND "leaseUntil" < NOW()
      `;

      if (result !== 1) {
        logger.warn(
          {
            event: "Job Recovery Skipped",
            jobId: job.id,
            previousWorkerId: job.workerId,
            leaseUntil: job.leaseUntil,
          },
          `Stale Job recovery skipped`,
        );

        continue;
      }
      const attemptResult = await tx.$executeRaw`
        UPDATE "JobAttempt"
        SET
        "status" = 'RECOVERED',
        "error" = 'worker lease expired and job was recovered',
        "finishedAt" = NOW(),
        "duration" = ROUND(
          EXTRACT(EPOCH FROM NOW() - "startedAt") * 1000
        )::int
        WHERE "jobId" = ${job.id}
         AND "status" = 'PROCESSING'
      `;
      logger.warn(
        {
          event: "Job Recovery Success",
          jobId: job.id,
          previousWorkerId: job.workerId,
          leaseUntil: job.leaseUntil,
          attemptMarkedRecovered: attemptResult,
        },
        `Stale Job Recovered`,
      );
      recoverCount++;
    }
    return recoverCount;
  });
}

export function startRecovery() {
  const interval = setInterval(async () => {
    try {
      await recoverStaleJobs();
    } catch (error) {
      logger.error(
        {
          event: "Job Recovery Failed",
          error: error instanceof Error ? error.message : String(error),
        },
        "Job Recovery failed",
      );
    }
  }, RECOVERY_INTERVAL);

  return () => {
    clearInterval(interval);
    logger.info(
      {
        event: "Job Recovery Stopped",
      },
      "Recovery stopped",
    );
  };
}
