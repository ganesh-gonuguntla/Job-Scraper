import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import Profile from '../models/Profile.js';
import Resume from '../models/Resume.js';

const router = Router();
const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF and DOCX files are allowed'));
  },
});

router.post('/skills', authenticate, async (req, res, next) => {
  try {
    const { skills, experience, location, target_roles } = req.body;

    const profile = await Profile.findOneAndUpdate(
      { user_id: req.user.id },
      {
        skills: skills || [],
        experience: experience || '',
        location: location || '',
        target_roles: target_roles || [],
      },
      { new: true, upsert: true }
    );

    const resume = await Resume.create({
      user_id: req.user.id,
      source: 'manual_skills',
      parsed_resume: {
        skills: skills || [],
        experience: experience ? [{ summary: experience }] : [],
      },
    });

    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    let analysisResult = null;
    try {
      const { data } = await axios.post(`${aiUrl}/resume/analyze`, {
        user_id: req.user.id,
        resume_id: resume._id.toString()
      });
      analysisResult = data;
    } catch (err) {
      console.error('Error calling AI service for skills embedding:', err.message);
    }

    const updatedProfile = await Profile.findOne({ user_id: req.user.id });
    res.status(201).json({ success: true, profile: updatedProfile, resume_id: resume._id, analysis: analysisResult });
  } catch (err) {
    next(err);
  }
});

router.post('/upload', authenticate, upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Resume file is required' });
    }

    const resumeUrl = `/uploads/${req.file.filename}`;

    const resume = await Resume.create({
      user_id: req.user.id,
      resume_url: resumeUrl,
      source: 'uploaded',
    });

    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    let analysisResult = null;
    try {
      const { data } = await axios.post(`${aiUrl}/resume/analyze`, {
        user_id: req.user.id,
        resume_id: resume._id.toString()
      });
      analysisResult = data;
    } catch (err) {
      console.error('Error calling AI service for resume analysis:', err.message);
    }

    const updatedProfile = await Profile.findOne({ user_id: req.user.id });
    const updatedResume = await Resume.findById(resume._id);
    res.status(201).json({
      success: true,
      resume: updatedResume,
      profile: updatedProfile,
      analysis: analysisResult,
      message: 'Resume uploaded and processed successfully.',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user_id: req.user.id });
    const resumes = await Resume.find({ user_id: req.user.id }).sort({ created_at: -1 });
    res.json({ success: true, profile, resumes });
  } catch (err) {
    next(err);
  }
});

export default router;
