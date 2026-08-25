import { prisma } from "../config/prisma";

export async function createJobAttempt(
  jobId: string,
  jobType: string,
  workerId: string,
  fencingToken: number,
  attempt: number,
) {
  return await prisma.jobAttempt.create({
    data: {
      jobId,
      jobType,
      workerId,
      fencingToken,
      attempt,
      status: "PROCESSING",
    },
  });
}

export async function finishJobAttempt(
  attemptId: string,
  status: "COMPLETED" | "FAILED" | "RETRIED" | "DEAD",
  startedAt: Date,
  error?: string,
) {
  const finishedAt = new Date();

  const durationMs = finishedAt.getTime() - startedAt.getTime();

  return await prisma.jobAttempt.update({
    where: { id: attemptId },
    data: { status, error: error ?? null, finishedAt, duration: durationMs },
  });
}
