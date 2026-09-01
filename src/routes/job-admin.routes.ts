
import { Router } from 'express';
import { getDeadJobs, getJobById, retryDeadJobManually } from '../worker/job-admin.service';

const router = Router();

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
