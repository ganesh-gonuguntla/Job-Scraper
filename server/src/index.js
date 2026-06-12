import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import jobsRoutes from './routes/jobs.js';
import matchRoutes from './routes/match.js';
import emailRoutes from './routes/email.js';
import applicationsRoutes from './routes/applications.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'job-agent-server',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/resume', profileRoutes);
app.use('/jobs', jobsRoutes);
app.use('/match', matchRoutes);
app.use('/generate-email', emailRoutes);
app.use('/apply', applicationsRoutes);
app.use('/applications', applicationsRoutes);
app.use('/settings', settingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
