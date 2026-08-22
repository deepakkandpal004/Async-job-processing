import http from "node:http"

import { startWorker } from "./jobs/job.worker";
import { getMetrics } from "./jobs/job.metrics";

const METRICS_PORT = Number(process.env.METRICS_PORT ?? 3001);

const metricsServer = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/metrics") {
    try {
      const metrics = await getMetrics();

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end(metrics);
    } catch (error) {
      console.error("Failed to generate metrics:", error);
      res.statusCode = 500;
      res.end("Failed to generate metrics:");
    }
    return;
  }
  res.statusCode = 404;
  res.end();
});

metricsServer.listen(METRICS_PORT, () => {
  console.log(`Worker metrics server listening on port ${METRICS_PORT}`);
});

startWorker();
