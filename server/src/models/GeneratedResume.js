import mongoose from 'mongoose';

const generatedResumeSchema = new mongoose.Schema(
  {
    match_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    resume_text: { type: String, default: '' },
    resume_file_url: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('GeneratedResume', generatedResumeSchema, 'generated_resumes');
