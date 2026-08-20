import { Router } from "express";
import { createJob } from "../jobs/job.service";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { type, payload, idempotentKey } = req.body;

    if (!type) {
      return res.status(200).json({
        message: "Job type is required",
      });
    }

    if (!idempotentKey) {
      return res.status(400).json({
        message: "idempotentKey is required",
      });
    }

    const job = await createJob({
      type,
      payload,
      idempotentKey,
    });

    return res.status(202).json({
      success: true,
      message: "Job created successfully",
      data: {
        id: job.id,
        status: job.status,
        idempotentKey: job.idempotentKey,
      },
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;
