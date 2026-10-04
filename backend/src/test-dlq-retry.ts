import { retryDeadJobManually } from "./worker/job-admin.service";

async function main() {
  const jodId = "cmt2u2so70000yctx35admabq";

  await retryDeadJobManually(jodId);
}

main().catch(console.error);
