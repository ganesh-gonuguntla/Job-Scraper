import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['applied', 'emailed', 'both', 'failed', 'pending_review'],
      default: 'pending_review',
    },
    applied_at: { type: Date },
  },
  { timestamps: true }
);

applicationSchema.index({ user_id: 1 });

export default mongoose.model('Application', applicationSchema);
