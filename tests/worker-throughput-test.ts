const TOTAL_JOBS = 60;

async function createJobs(index: number) {
  const response = await fetch("http://localhost:3000/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "WORKER_THROUGHPUT_TEST",
      payload: {
        index,
      },
      idempotentKey: `worker-throughput-${Date.now()} - ${index}`,
      priority: 10,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create job ${index}:${response.status} ${body}`);
  }
}

async function getStats() {
  const response = await fetch(
    "http://localhost:3000/admin/jobs?type=WORKER_THROUGHPUT_TEST&limit=100",
  );

  if (!response.ok) {
    throw new Error(
      `Failed to get jobs: ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
}

async function runs() {
  console.log("\n<<<<<<< WORKER THROUGHPUT TEST >>>>>>>\n");

  const start = Date.now();

  console.log(`Creating ${TOTAL_JOBS} test jobs...`);

  await Promise.all(
    Array.from({ length: TOTAL_JOBS }, (_, index) => createJobs(index)),
  );

  console.log(`All test jobs created...`);

  while (true) {
    const stats = await getStats();
    const jobs = stats.data ?? [];

    const completed = jobs.filter(
      (job: { status: string }) => job.status === "COMPLETED",
    ).length;

    const processing = jobs.filter(
      (job: { status: string }) => job.status === "PROCESSING",
    ).length;

    const queued = jobs.filter(
      (job: { status: string }) => job.status === "QUEUED",
    ).length;

    const elapsed = (Date.now() - start) / 1000;

    console.log(
      `Elapsed: ${elapsed.toFixed(1)}s | ` +
        `Queued: ${queued} | ` +
        `Processing: ${processing} | ` +
        `Completed: ${completed}`,
    );

    if (completed === TOTAL_JOBS) {
      const duration = (Date.now() - start) / 1000;
      const throughput = TOTAL_JOBS / duration;

      console.log("\n<<<<<<< RESULT >>>>>>>");
      console.log(`Total jobs : ${TOTAL_JOBS}`);
      console.log(`Duration   : ${duration.toFixed(2)}s`);
      console.log(`Throughput : ${throughput.toFixed(3)} jobs/sec`);
      console.log(`Throughput : ${(throughput * 60).toFixed(2)} jobs/min`);
      console.log("<<<<<<< END >>>>>>>");
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

runs().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
