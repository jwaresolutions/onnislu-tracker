import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import dataService from '../services/DataService';

const router = Router();

// GET /api/status - Get system status and next collection time
router.get('/', asyncHandler(async (req: Request, res: Response) => {
 logger.info('Fetching system status');

 const [health, stats, settings] = await Promise.all([
   dataService.checkHealth(),
   dataService.getStatistics(),
   dataService.getAllSettings()
 ]);

 const connected = !!(health.success && health.data && health.data.connected === true);
 const integrity = health.success && health.data ? (health.data.integrity || 'unknown') : 'unknown';

 const settingsMap = new Map<string, string>(
   Array.isArray(settings.data) ? settings.data.map((s: any) => [s.key, s.value]) : []
 );

 const status = {
   isHealthy: connected && integrity === 'ok',
   timestamp: new Date().toISOString(),
   uptime: process.uptime(),
   memory: process.memoryUsage(),
   version: process.env.npm_package_version || '1.0.0',
   environment: process.env.NODE_ENV || 'development',
   database: {
     connected,
     integrity,
     stats: stats.success ? stats.data : undefined,
     error: health.success ? undefined : (health.error || 'unknown')
   },
   scheduler: {
     running: false,
     lastCollection: settingsMap.get('last_collection_time') || null,
     nextCollection: settingsMap.get('next_collection_time') || null
   },
   scraper: {
     lastRun: settingsMap.get('last_collection_time') || null,
     status: 'pending'
   }
 };

 res.json({
   success: true,
   data: status
 });
}));

export default router;

// Scheduler status and controls
// GET /api/status/scheduler - current scheduler status
router.get('/scheduler', asyncHandler(async (req: Request, res: Response) => {
  const { default: schedulerService } = await import('../services/SchedulerService');
  const status = schedulerService.getStatus();
  res.json({ success: true, data: status });
}));

// POST /api/status/scheduler/run - trigger a manual run now
router.post('/scheduler/run', asyncHandler(async (req: Request, res: Response) => {
  const { default: schedulerService } = await import('../services/SchedulerService');
  const summary = await schedulerService.runNow();
  res.json({ success: true, data: summary });
}));

// POST /api/status/scheduler/start - start scheduled cron jobs
router.post('/scheduler/start', asyncHandler(async (req: Request, res: Response) => {
  const { default: schedulerService } = await import('../services/SchedulerService');
  await schedulerService.start();
  res.json({ success: true, data: schedulerService.getStatus() });
}));

// POST /api/status/scheduler/stop - stop scheduled cron jobs
router.post('/scheduler/stop', asyncHandler(async (req: Request, res: Response) => {
  const { default: schedulerService } = await import('../services/SchedulerService');
  await schedulerService.stop();
  res.json({ success: true, data: schedulerService.getStatus() });
}));
