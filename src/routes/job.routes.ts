import { Router } from "express";
import { createJob } from "../jobs/job.service";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { type, payload } = req.body;

    if (!type) {
      return res.status(200).json({
        message: "Job type is required",
      });
    }

    const job = await createJob({
      type,
      payload,
    });

    return res.status(202).json({
      id: job.id,
      status: job.status,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;
