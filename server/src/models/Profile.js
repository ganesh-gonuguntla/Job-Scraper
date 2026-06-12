import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    skills: [{ type: String, trim: true }],
    experience: { type: String, default: '' },
    location: { type: String, default: '' },
    target_roles: [{ type: String, trim: true }],
    preferences: {
      auto_apply: { type: Boolean, default: true },
      review_before_send: { type: Boolean, default: false },
      follow_up_days: { type: Number, default: 7 },
      match_threshold: { type: Number, default: 40 },
      smtp_pass: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Profile', profileSchema);
