import { prisma } from "../config/prisma";
import { retryDeadJob } from "../jobs/job.repository";

export async function retryDeadJobManually(jobId: string) {
  const result = await retryDeadJob(jobId);

  if (result.count === 0) {
    throw new Error(`Job ${jobId} is not DEAD or doesnt exists`);
  }
  console.log(`Job ${jobId} moved from DEAD -> QUEUED`);
}

export async function getDeadJobs() {
  return prisma.job.findMany({
    where: {
      status: "DEAD",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      payload: true,
      type: true,
      priority: true,
      status: true,
      maxAttempts: true,
      createdAt: true,
      updatedAt: true,
      attempts: true,
      deadAt: true,
      lastError: true,
    },
  });
}

export async function getJobById(jobId: string) {
  return prisma.job.findUnique({
    where: {
      id: jobId,
    },
  });
}
