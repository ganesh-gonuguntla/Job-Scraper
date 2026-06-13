import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import { validateBody, matchSchema } from '../middleware/validation.js';
import Match from '../models/Match.js';
import Job from '../models/Job.js';

const router = Router();

router.post('/', authenticate, validateBody(matchSchema), async (req, res, next) => {
  try {
    const { job_id } = req.body;

    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const { data } = await axios.post(`${aiUrl}/jobs/match`, {
      user_id: req.user.id,
      job_id,
    });

    res.json({ success: true, match: data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const matches = await Match.find({ user_id: req.user.id })
      .populate('job_id')
      .sort({ created_at: -1 });
    res.json({ success: true, matches });
  } catch (err) {
    next(err);
  }
});

export default router;
