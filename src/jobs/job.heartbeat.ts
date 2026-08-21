import { prisma } from "../config/prisma";
import {
  HEARTBEAT_INTERVAL,
} from "./job.constants";

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
        console.log(
          `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
            `Heartbeat renewed Job ${jobId} | ` + `Worker: ${workerId} | ` + `Token: ${fencingToken}`,
        );
      } else {
        console.log(
          `[${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}] ` +
            `Heartbeat lost ownership  | ` + `Job: ${jobId} | ` + `Worker: ${workerId} | ` + `Token: ${fencingToken}`,
        );
        stopped = true;
        clearInterval(interval);
        onOwnershipLost();
      }
    } catch (error) {
      console.error(
        `Heartbeat failed for Job ${jobId}:`,
        error,
      );
    }
  }, HEARTBEAT_INTERVAL);

  return () => {
    stopped = true;
    clearInterval(interval);

    console.log(
      `Heartbeat stopped for Job ${jobId}`,
    );
  };
}
