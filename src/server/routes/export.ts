import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import exportService from '../services/ExportService';

const router = Router();

// GET /api/export/csv - Export data as CSV
router.get('/csv', asyncHandler(async (req: Request, res: Response) => {
 const { start, end, limit } = req.query;
 logger.info('Exporting data as CSV', { start, end, limit });

 const startStr = typeof start === 'string' ? start : undefined;
 const endStr = typeof end === 'string' ? end : undefined;
 const limitNum = typeof limit === 'string' ? Number(limit) : (typeof limit === 'number' ? limit : undefined);

 await exportService.streamPriceHistoryCSV(res, {
   start: startStr,
   end: endStr,
   limit: limitNum,
   filenamePrefix: 'price_history',
   includeHeader: true
 });
}));

export default router;