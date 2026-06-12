import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    score: { type: Number, required: true },
    missing_skills: [{ type: String }],
    status: {
      type: String,
      enum: ['pending', 'qualified', 'low_match'],
      default: 'pending',
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

matchSchema.index({ user_id: 1, job_id: 1 }, { unique: true });

export default mongoose.model('Match', matchSchema);
