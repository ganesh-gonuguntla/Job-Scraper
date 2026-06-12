import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import Match from '../models/Match.js';
import Job from '../models/Job.js';

const router = Router();

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { job_id } = req.body;
    if (!job_id) {
      return res.status(400).json({ success: false, message: 'job_id is required' });
    }

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
