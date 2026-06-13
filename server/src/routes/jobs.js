import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateQuery, jobQuerySchema } from '../middleware/validation.js';
import Job from '../models/Job.js';
import Match from '../models/Match.js';

const router = Router();

router.get('/', authenticate, validateQuery(jobQuerySchema), async (req, res, next) => {
  try {
    const { limit = 50, skip = 0 } = req.query;
    
    // Get jobs that the user hasn't already matched with
    const matchedJobIds = await Match.find({ user_id: req.user.id }).select('job_id');
    const matchedIds = matchedJobIds.map(m => m.job_id);
    
    const jobs = await Job.find({ _id: { $nin: matchedIds } })
      .sort({ scraped_at: -1 })
      .skip(Number(skip))
      .limit(Number(limit));
    
    const total = await Job.countDocuments({ _id: { $nin: matchedIds } });
    
    res.json({ success: true, jobs, total, filtered: true });
  } catch (err) {
    next(err);
  }
});

export default router;
