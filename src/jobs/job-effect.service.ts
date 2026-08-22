import { logger } from "../config/logger";
import { Prisma } from "../generated/prisma/client";
import { createJobEffect } from "./job-effect.repository"
import { RetryableJobError, PermanentJobError } from "./job.errors";

export async function executeJobEffect(
  idempotentKey: string,
  jobId: string,
  type: string,
) {
  if (type === "RETRY_TEST") {
    throw new RetryableJobError(
      "Simulated temporary failure",
    );
  }

  if (type === "PERMANENT_TEST") {
    throw new PermanentJobError(
      "Simulated permanent failure",
    );
  }
  try {
    await createJobEffect(
      idempotentKey,
      jobId,
      type,
    );

    logger.info(
      {
        jobId,
        type,
      },
      "Side Effect Executed",
    )

    return { executed: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      logger.info(
        {
          jobId,
          type,
        },
        "Side Effect already executed",
      )

      return { executed: false };
    }
    throw error;
  }
}
