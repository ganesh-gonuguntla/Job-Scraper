import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { connectDB } from './config/db.js';
import { validateEnvironment, validateMongoDBURI } from './config/validate-env.js';
import logger from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import jobsRoutes from './routes/jobs.js';
import matchRoutes from './routes/match.js';
import emailRoutes from './routes/email.js';
import applicationsRoutes from './routes/applications.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();
// Configure environment variables from .env file


const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.',
});

app.use(authLimiter);
app.use(apiLimiter);

import mongoose from 'mongoose';

app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    const mongoConnection = mongoose.connection;
    if (mongoConnection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        service: 'job-agent-server',
        status: 'unhealthy',
        reason: 'Database not connected',
        timestamp: new Date().toISOString(),
      });
    }
    res.json({
      success: true,
      service: 'job-agent-server',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      service: 'job-agent-server',
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
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
    // Validate environment variables before starting
    validateEnvironment();
    validateMongoDBURI();

    await connectDB();
    const server = app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });

    // Graceful shutdown on SIGTERM (Docker/Kubernetes)
    process.on('SIGTERM', () => {
      logger.warn('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        logger.info('HTTP server closed');
        await require('mongoose').connection.close();
        logger.info('Database connection closed');
        process.exit(0);
      });
      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    });

    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.warn('SIGINT received, shutting down gracefully...');
      server.close(async () => {
        logger.info('HTTP server closed');
        await require('mongoose').connection.close();
        logger.info('Database connection closed');
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error('Failed to start server:', { error: err.message });
    process.exit(1);
  }
}

start();
