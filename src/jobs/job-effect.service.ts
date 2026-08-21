import { Prisma } from "../generated/prisma/client";
import { createJobEffect } from "./job-effect.repository"

export async function executeJobEffect(
  idempotentKey: string,
  jobId: string,
  type: string,
) {
  try {
    await createJobEffect(
      idempotentKey,
      jobId,
      type,
    );

  console.log(`[${new Date().toLocaleTimeString()}]` + ` Side Effect Executed | Job ${jobId}`);

    return { executed: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.log(`[${new Date().toLocaleTimeString()}]` + ` Side Effect already executed | Job ${jobId}`);

      return { executed: false };
    }
    throw error;
  }
}
