import { retryDeadJob } from "../jobs/job.repository";

export async function retryDeadJobManually(jobId: string) {
  const result = await retryDeadJob(jobId);

  if (result.count === 0) {
    throw new Error(`Job ${jobId} is not DEAD or doesnt exists`);
  }
  console.log(`Job ${jobId} moved from DEAD -> QUEUED`);
}
