import { prisma } from "../config/prisma";
import { WORKER_ID } from "./job.constants";

export async function createJob(
  type: string,
  payload: any,
) {
  return prisma.job.create({
    data: {
      type,
      payload,
    },
  });
}

export async function claimNextJob() {
  return prisma.$transaction(async (tx) => {
    const jobs = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Job"
      WHERE "status" = 'QUEUED'
        AND "availableAt" <= NOW()
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    if (jobs.length === 0) {
      return null;
    }

    await tx.job.update({
      where: {
        id: jobs[0].id,
      },
      data: {
        status: "PROCESSING",
        attempts: {
          increment: 1,
        },
        workerId: WORKER_ID,
      },
    });

    await tx.$executeRaw`
      UPDATE "Job"
      SET "leaseUntil" = NOW() + INTERVAL '10 seconds'
      WHERE "id" = CAST(${jobs[0].id} AS TEXT)
    `;

    return tx.job.findUnique({
      where: {
        id: jobs[0].id,
      },
    });
  });
}
