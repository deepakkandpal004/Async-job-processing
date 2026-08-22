import { logger } from "../config/logger";
import { prisma } from "../config/prisma";
import { HEARTBEAT_INTERVAL } from "./job.constants";

export function startHeartbeat(
  jobId: string,
  fencingToken: number,
  workerId: string,
  onOwnershipLost: () => void,
) {
  let stopped = false;

  const interval = setInterval(async () => {
    if (stopped) {
      return;
    }

    try {
      const result = await prisma.$executeRaw`
        UPDATE "Job"
        SET "leaseUntil" = NOW() + INTERVAL '10 seconds'
        WHERE "id" = CAST(${jobId} AS TEXT)
          AND "status" = 'PROCESSING'
          AND "fencingToken" = ${fencingToken}
      `;

      if (result === 1) {
        logger.info(
          {
            event: "Heartbeat Renewed",
            jobId,
            workerId,
            fencingToken,
          },
          "Heartbeat Renewed",
        );
      } else {
        logger.warn(
          {
            event: "heartbeat OwnerShip Lost",
            jobId,
            workerId,
            fencingToken,
          },
          "Heartbeat lost ownership",
        );
        stopped = true;
        clearInterval(interval);
        onOwnershipLost();
      }
    } catch (error) {
      logger.error(
        {
          event: "Heartbeat Error",
          jobId,
          workerId,
          fencingToken,
          error: error instanceof Error ? error.message : String(error),
        },
        "Heartbeat Failed",
      );
    }
  }, HEARTBEAT_INTERVAL);

  return () => {
    stopped = true;
    clearInterval(interval);

    logger.info(
      {
        event: "Heartbeat Stopped",
        jobId,
        workerId,
        fencingToken,
      },
      "Heartbeat Stopped",
    );
  };
}
