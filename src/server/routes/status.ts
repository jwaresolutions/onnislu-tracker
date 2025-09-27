import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// GET /api/status - Get system status and next collection time
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching system status');
  
  // TODO: Implement actual system health checks and scheduler status
  // This will be implemented in later tasks when scheduler service is ready
  
  const status = {
    isHealthy: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: false, // Will be updated when database service is implemented
      message: 'Database connection pending implementation'
    },
    scheduler: {
      running: false, // Will be updated when scheduler service is implemented
      nextCollection: null,
      message: 'Scheduler service pending implementation'
    },
    scraper: {
      lastRun: null,
      status: 'pending', // Will be updated when scraper service is implemented
      message: 'Scraper service pending implementation'
    }
  };
  
  res.json({
    success: true,
    data: status
  });
}));

export default router;