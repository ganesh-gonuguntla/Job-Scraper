import mongoose from 'mongoose';

const sentEmailSchema = new mongoose.Schema(
  {
    email_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedEmail', required: true },
    sent_status: { type: String, default: 'pending' },
    sent_time: { type: Date },
    channel: { type: String, enum: ['apply_portal', 'direct_hr_email'], default: 'direct_hr_email' },
  },
  { timestamps: false }
);

export default mongoose.model('SentEmail', sentEmailSchema, 'sent_emails');
