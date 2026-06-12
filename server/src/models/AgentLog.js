import mongoose from 'mongoose';

const agentLogSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    agent_name: { type: String, required: true },
    action: { type: String, required: true },
    status: { type: String, default: 'info' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

agentLogSchema.index({ user_id: 1, timestamp: -1 });

export default mongoose.model('AgentLog', agentLogSchema, 'agent_logs');
