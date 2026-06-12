import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import Application from '../models/Application.js';

const router = Router();

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { match_id } = req.body;
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const { data } = await axios.post(`${aiUrl}/apply/submit`, {
      user_id: req.user.id,
      match_id,
    });
    res.json({ success: true, application: data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const applications = await Application.find({ user_id: req.user.id })
      .populate('job_id')
      .sort({ createdAt: -1 });
    res.json({ success: true, applications });
  } catch (err) {
    next(err);
  }
});

export default router;
