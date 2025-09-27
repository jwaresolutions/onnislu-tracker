import { Router, Request, Response } from 'express';
import { validate, schemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// GET /api/prices/latest - Get latest prices for all floor plans
router.get('/latest', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching latest prices for all floor plans');
  
  // TODO: Implement database query to get latest prices
  // This will be implemented in a later task when the database service is ready
  
  res.json({
    success: true,
    data: {
      prices: [],
      lastUpdated: new Date().toISOString(),
      message: 'Latest prices endpoint ready - database integration pending'
    }
  });
}));

// GET /api/prices/history - Get price history range
router.get('/history',
  validate(schemas.dateRange, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { start, end, limit } = req.query;
    
    logger.info('Fetching price history range', { start, end, limit });
    
    // TODO: Implement database query to get price history within date range
    // This will be implemented in a later task when the database service is ready
    
    res.json({
      success: true,
      data: {
        history: [],
        dateRange: { start, end },
        message: 'Price history endpoint ready - database integration pending'
      }
    });
  })
);

export default router;