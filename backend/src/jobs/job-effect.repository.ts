import { prisma } from "../config/prisma"

export async function createJobEffect(
  idempotentKey: string,
  jobId: string,
  type: string,
) {
  return prisma.jobEffect.create({
    data: {
      idempotentKey,
      jobId,
      type,
    },
  })
}
