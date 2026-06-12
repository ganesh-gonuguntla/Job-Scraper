import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    jd_text: { type: String, default: '' },
    skills_required: [{ type: String }],
    apply_url: { type: String, default: '' },
    location: { type: String, default: '' },
    source: { type: String, default: '' },
    embedding: { type: [Number], default: [] },
    scraped_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.model('Job', jobSchema);
