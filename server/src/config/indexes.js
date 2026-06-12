/**
 * MongoDB Atlas Vector Search index definitions.
 * Run these in MongoDB Atlas UI or via mongosh after deployment.
 *
 * Index: resume_embedding_index
 * Collection: resumes
 * {
 *   "fields": [
 *     { "type": "vector", "path": "embedding", "numDimensions": 384, "similarity": "cosine" }
 *   ]
 * }
 *
 * Index: job_embedding_index
 * Collection: jobs
 * {
 *   "fields": [
 *     { "type": "vector", "path": "embedding", "numDimensions": 384, "similarity": "cosine" }
 *   ]
 * }
 *
 * Standard indexes (run via mongosh):
 */

export const standardIndexes = [
  { collection: 'users', index: { email: 1 }, options: { unique: true } },
  { collection: 'matches', index: { user_id: 1, job_id: 1 }, options: { unique: true } },
  { collection: 'applications', index: { user_id: 1 } },
  { collection: 'agent_logs', index: { user_id: 1, timestamp: -1 } },
];
