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

    for (const job of staleJobs) {
      console.log(
        `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
          `Recovering stale Job ${job.id} | ` +
          `Previous Worker: ${job.workerId}` +
          ` | Lease Until: ${job.leaseUntil?.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      );

      await tx.job.update({
        where: {
          id: job.id,
        },
        data: {
          status: "QUEUED",
          workerId: null,
          leaseUntil: null,
          availableAt: new Date(),
        },
      });
    }
    return staleJobs.length;
  });
}

export function startRecovery() {
  setInterval(async () => {
    try {
      await recoverStaleJobs();
    } catch (error) {
      console.error("Job recovery failed: ", error);
    }
  }, RECOVERY_INTERVAL);
}
