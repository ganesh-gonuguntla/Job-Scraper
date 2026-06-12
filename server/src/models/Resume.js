import mongoose from 'mongoose';

const parsedResumeSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    skills: [{ type: String }],
    projects: [{ type: mongoose.Schema.Types.Mixed }],
    education: [{ type: mongoose.Schema.Types.Mixed }],
    experience: [{ type: mongoose.Schema.Types.Mixed }],
    achievements: [{ type: String }],
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resume_url: { type: String, default: '' },
    parsed_resume: { type: parsedResumeSchema, default: () => ({}) },
    embedding: { type: [Number], default: [] },
    source: { type: String, enum: ['uploaded', 'manual_skills'], default: 'uploaded' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export default mongoose.model('Resume', resumeSchema);
