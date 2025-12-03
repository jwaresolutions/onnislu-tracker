import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import dataService from '../services/DataService';

const router = Router();

// GET /api/settings - Get all settings
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching all settings');

  const result = await dataService.getAllSettings();
  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error || 'Failed to fetch settings' });
  }

  res.json({
    success: true,
    data: {
      settings: result.data
    }
  });
}));

// GET /api/settings/:key - Get specific setting
router.get('/:key', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;

  logger.info('Fetching setting', { key });

  const result = await dataService.getSetting(key);
  if (!result.success) {
    return res.status(500).json({ success: false, error: result.error || 'Failed to fetch setting' });
  }

  res.json({
    success: true,
    data: {
      setting: result.data
    }
  });
}));

export default router;
