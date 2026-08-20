import { prisma } from "../config/prisma";
import { WORKER_ID } from "./job.constants";

export async function createJob(
  type: string,
  payload: any,
  idempotentKey: string,
) {
  const existing = await prisma.job.findUnique({
    where: { idempotentKey },
  });
  if (existing) {
    return existing;
  }

  try {
    return await prisma.job.create({
      data: {
        type,
        payload,
        idempotentKey,
      },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      const existingAfterRace = await prisma.job.findUnique({
        where: { idempotentKey },
      });
      if (existingAfterRace) {
        return existingAfterRace;
      }
    }
    throw error;
  }
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

export async function completeJob(jobId: string) {
  return await prisma.job.updateMany({
    where: {
      id: jobId,
      status: "PROCESSING",
      workerId: WORKER_ID,
    },
    data: {
      status: "COMPLETED",
      workerId: null,
      leaseUntil: null,
    },
  });
}
