import { Router, Request, Response } from 'express';
import { validate, schemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import dataService from '../services/DataService';

const router = Router();

// GET /api/prices/latest - Get latest prices for all floor plans
router.get('/latest', asyncHandler(async (req: Request, res: Response) => {
 logger.info('Fetching latest prices for all floor plans');

 const result = await dataService.getLatestPrices();
 if (!result.success) {
   return res.status(500).json({ success: false, error: result.error || 'Failed to fetch latest prices' });
 }

 res.json({
   success: true,
   data: result.data
 });
}));

// GET /api/prices/history - Get price history range
router.get('/history',
 validate(schemas.dateRange, 'query'),
 asyncHandler(async (req: Request, res: Response) => {
   const { start, end, limit } = req.query;

   logger.info('Fetching price history range', { start, end, limit });

   const startStr = typeof start === 'string' ? start : undefined;
   const endStr = typeof end === 'string' ? end : undefined;
   const limitNum = typeof limit === 'string' ? Number(limit) : (typeof limit === 'number' ? limit : undefined);

   const result = await dataService.getPriceHistoryRange(startStr, endStr, limitNum);
   if (!result.success) {
     return res.status(500).json({ success: false, error: result.error || 'Failed to fetch price history' });
   }

   res.json({
     success: true,
     data: {
       history: result.data,
       dateRange: { start: startStr || null, end: endStr || null }
     }
   });
 })
);

export default router;