import { Router } from "express";
import { cancelJob, createJob } from "../jobs/job.service";
import { rateLimit } from "../middleware/rate-limit";

const router = Router();

router.post("/", rateLimit, async (req, res) => {
  try {
    const { type, payload, idempotentKey, priority = 0, delay = 0 } = req.body;

    if (!type) {
      return res.status(400).json({
        message: "Job type is required",
      });
    }

    if (!idempotentKey) {
      return res.status(400).json({
        message: "idempotentKey is required",
      });
    }

    if (!Number.isInteger(priority)) {
      return res.status(400).json({
        message: "priority must be an integer",
      });
    }

    if (priority < -10 || priority > 10) {
      return res.status(400).json({
        message: "priority must be between -10 and 10",
      });
    }

    if (!Number.isInteger(delay) ||delay < 0) {
      return res.status(400).json({
        message: "delay cannot be negative",
      });
    }

    const availableAt = new Date(Date.now() + delay);

    const job = await createJob({
      type,
      payload,
      idempotentKey,
      priority,
      availableAt,
    });

    return res.status(202).json({
      success: true,
      message: "Job created successfully",
      data: {
        id: job.id,
        status: job.status,
        idempotentKey: job.idempotentKey,
        priority: job.priority,
        availableAt: job.availableAt,
      },
    });
  } catch (error) {
    console.error("Failed to create job", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.delete("/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await cancelJob(jobId);

    if (result.count === 0) {
      return res.status(409).json({
        success: false,
        message: "Job cannot be cancelled",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Job cancelled successfully",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;
