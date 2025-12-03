// Main server entry point
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';

// Import middleware
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './utils/logger';

// Import routes
import apiRoutes from './routes';
import { initializeDatabase } from './database';
import schedulerService from './services/SchedulerService';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Security and parsing middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Static assets (plan images cached under /public/plan-images)
app.use('/static', express.static(path.join(process.cwd(), 'public'), {
  immutable: true,
  maxAge: '365d'
}));

// API routes
app.use('/api', apiRoutes);

// Initialize database and start scheduler
(async () => {
  const dbInit = await initializeDatabase();
  if (!dbInit.success) {
    logger.error('Database initialization failed', { error: dbInit.error });
  } else {
    logger.info('Database initialized');
  }
  try {
    await schedulerService.start();
    logger.info('Scheduler started');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to start scheduler', { error: msg });
  }
})();

// Serve static files from React build (only in production)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.resolve(__dirname, '../client');
  app.use(express.static(clientPath));
  
  // Catch-all handler for React app (only for non-API routes)
  app.get('*', (req, res, next) => {
    // Don't handle API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.resolve(clientPath, 'index.html'));
  });
}

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  try { schedulerService.stop(); } catch {}
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  try { schedulerService.stop(); } catch {}
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});