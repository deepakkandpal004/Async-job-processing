import express from "express";
import { getWorkerMetrics, getWorkerMetricsContentType } from "./worker.metrics";

export function startWorkerMetricsServer(port: number) {
  const app = express();

  app.get("/metrics", async (req, res) => {
    try {
      res.set("Content-Type", getWorkerMetricsContentType());
      res.end(await getWorkerMetrics());
    } catch (error) {
      console.error("Failed to get worker metrics", error);
      res.status(500).send("Failed to generate worker metrics");
    }
  });

  const server = app.listen(port, () => {
    console.log(`Worker metrics server listening on port ${port}`);
  });

  return (() => {
    server.close();
    console.log("Worker metrics server closed");
  });
}
