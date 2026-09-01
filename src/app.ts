import express from "express"
import jobRoutes from "./routes/job.routes"
import jobAdminRoutes from "./routes/job-admin.routes"
import { getMetrics, getMetricsContentType, updateSystemMetrics,  } from "./jobs/job.metrics";

const app = express();
app.use(express.json());

app.use("/jobs", jobRoutes);
app.use("/admin/jobs", jobAdminRoutes);

app.get("/metrics", async (req, res) => {
  try {
    await updateSystemMetrics();

    res.set("Content-Type", getMetricsContentType());

    res.end(await getMetrics());
  } catch (error) {
    console.error("Failed to generate metrics", error);
    res.status(500).send("Failed to generate metrics");
  }
});

export default app;
