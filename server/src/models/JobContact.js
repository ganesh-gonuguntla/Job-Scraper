import mongoose from 'mongoose';

const jobContactSchema = new mongoose.Schema(
  {
    job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    hr_name: { type: String, default: '' },
    designation: { type: String, default: '' },
    email: { type: String, default: '' },
    email_source: { type: String, default: '' },
    confidence_score: { type: Number, default: 0 },
  },
  { timestamps: false }
);

export default mongoose.model('JobContact', jobContactSchema, 'job_contacts');
