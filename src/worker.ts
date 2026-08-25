import { startWorker } from "./jobs/job.worker";
import { startWorkerMetricsServer } from "./jobs/worker.metrics.server";
import { WORKER_METRICS_PORT } from "./jobs/job.constants";

startWorker();

startWorkerMetricsServer(WORKER_METRICS_PORT);
