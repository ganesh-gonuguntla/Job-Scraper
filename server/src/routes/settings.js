import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import { validateBody, settingsSchema } from '../middleware/validation.js';
import Profile from '../models/Profile.js';
import AgentLog from '../models/AgentLog.js';

const router = Router();

router.patch('/', authenticate, validateBody(settingsSchema), async (req, res, next) => {
  // Patch settings route for auto-apply parameters and App Passwords

  try {
    const { auto_apply, review_before_send, follow_up_days, match_threshold, smtp_pass } = req.body;
    const update = {};

    if (auto_apply !== undefined) update['preferences.auto_apply'] = auto_apply;
    if (review_before_send !== undefined) update['preferences.review_before_send'] = review_before_send;
    if (follow_up_days !== undefined) update['preferences.follow_up_days'] = follow_up_days;
    if (match_threshold !== undefined) update['preferences.match_threshold'] = match_threshold;
    if (smtp_pass !== undefined) update['preferences.smtp_pass'] = smtp_pass;

    const profile = await Profile.findOneAndUpdate(
      { user_id: req.user.id },
      { $set: update },
      { new: true }
    );

    res.json({ success: true, preferences: profile.preferences });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', authenticate, async (req, res, next) => {
  try {
    const logs = await AgentLog.find({ user_id: req.user.id })
      .sort({ timestamp: -1 })
      .limit(100);
    res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
});

router.post('/agent/run', authenticate, async (req, res, next) => {
  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const { data } = await axios.post(`${aiUrl}/agent/run`, { user_id: req.user.id });
    res.json({ success: true, result: data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

export default router;
