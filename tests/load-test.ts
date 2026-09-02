const TOTAL_REQUESTS = 5000;
const CONCURRENCY = 10;

let completed = 0;
let failed = 0;

async function createJob(index: number) {
  const idempotentKey = `load-test-${Date.now()}-${index}`;
  try {
    const response = await fetch("http://localhost:3000/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "LOAD_TEST",
        payload: {
          index,
        },
        idempotentKey,
        priority: 0,
      }),
    });

    if (response.ok) {
      completed++;
      return;
    }
    failed++;
    const body = await response.text();
    console.log(`Request ${index} failed: ${response.status}, ${body}`);
  } catch (error: unknown) {
    failed++;

    console.log(`Request ${index} error:`, error instanceof Error ? error.message : String(error))
  }
}

async function run() {
  console.log("<<<<<<< START >>>>>>>\n");

  const start = Date.now();

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= TOTAL_REQUESTS) return;
      await createJob(index);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(),));


  const duration = (Date.now() - start) / 1000;

  console.log("\n<<<<<<< LOAD TEST >>>>>>>");
  console.log(`Total requests : ${TOTAL_REQUESTS}`);
  console.log(`Concurrency    : ${CONCURRENCY}`);
  console.log(`Completed      : ${completed}`);
  console.log(`Failed         : ${failed}`);
  console.log(`Duration       : ${duration.toFixed(2)}s`);
  console.log(`Throughput     : ${(TOTAL_REQUESTS / duration).toFixed(2)} req/s`);
  console.log("<<<<<<< END >>>>>>>");
}

run();
