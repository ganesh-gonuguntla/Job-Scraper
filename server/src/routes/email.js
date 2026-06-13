import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { z } from 'zod';

const router = Router();

const emailSchema = z.object({
  match_id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid match_id format'),
});

router.post('/', authenticate, validateBody(emailSchema), async (req, res, next) => {
  try {
    const { match_id } = req.body;
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const { data } = await axios.post(`${aiUrl}/email/create`, {
      user_id: req.user.id,
      match_id,
    });
    res.json({ success: true, email: data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    next(err);
  }
});

export default router;
