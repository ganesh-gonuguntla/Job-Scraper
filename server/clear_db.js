import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/job-agent';

async function clearDb() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB at:', mongoUri);
    
    const db = mongoose.connection.db;
    const collections = ['jobs', 'matches', 'applications', 'sent_emails', 'agent_logs'];
    
    for (const name of collections) {
      const col = db.collection(name);
      const count = await col.countDocuments({});
      if (count > 0) {
        await col.deleteMany({});
        console.log(`Cleared ${count} documents from collection '${name}'`);
      } else {
        console.log(`Collection '${name}' is already empty.`);
      }
    }
    
    console.log('Database cleanup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error during database cleanup:', err);
    process.exit(1);
  }
}

clearDb();
