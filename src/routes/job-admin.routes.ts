import { Router } from 'express';
import { getDeadJobs, getJobById, getJobs, retryDeadJobManually } from '../worker/job-admin.service';
import { JobStatus } from '../generated/prisma/enums';

const router = Router();

router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;

    const priority =
      req.query.priority !== undefined
        ? Number(req.query.priority)
        : undefined;

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        success: false,
        message: "page must be a positive integer",
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "limit must be between 1 and 100",
      });
    }

    if (priority !== undefined && !Number.isInteger(priority)) {
      return res.status(400).json({
        success: false,
        message: "priority must be an integer",
      });
    }

    const result = await getJobs({
      page,
      limit,
      status: status as JobStatus | undefined,
      type,
      priority,
    });

    return res.status(200).json({
      success: true,
      data: result.jobs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.get('/dead', async (req, res) => {
  try {
    const jobs = await getDeadJobs();

    return res.status(200).json({
      success: true,
      data: jobs,
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const job = await getJobById(id);

    if(!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
});

router.post("/:id/retry", async (req, res) => {
  try {
    const { id } = req.params;
    await retryDeadJobManually(id);

    return res.status(200).json({
      success: true,
      message: 'Dead Job moved back to queue'
    });
  } catch (error) {
    console.error(error);
    res.status(409).json({
      success: false,
      message: error instanceof Error ? error.message : "Job could not be retried",
    });
  }
});

export default router;
