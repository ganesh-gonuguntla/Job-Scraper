import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import Job from '../models/Job.js';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit = 50, skip = 0 } = req.query;
    const jobs = await Job.find()
      .sort({ scraped_at: -1 })
      .skip(Number(skip))
      .limit(Number(limit));
    const total = await Job.countDocuments();
    res.json({ success: true, jobs, total });
  } catch (err) {
    next(err);
  }
});

export default router;
