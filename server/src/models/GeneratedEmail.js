import mongoose from 'mongoose';

const generatedEmailSchema = new mongoose.Schema(
  {
    job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    match_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    recipient_email: { type: String, default: '' },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    generation_context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model('GeneratedEmail', generatedEmailSchema, 'generated_emails');
