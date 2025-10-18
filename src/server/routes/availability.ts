import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { ScraperService } from '../services/ScraperService';
import { scraperConfig, secureCafeUrl } from '../config/scraper';

const router = Router();
const scraper = new ScraperService();

const DEFAULT_URL = secureCafeUrl;

// GET /api/availability?wings=D,E
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const wingsQuery = (req.query.wings as string) || '';
    const wings = (wingsQuery ? wingsQuery.split(',') : scraperConfig.defaultWings)
      .map((w) => w.trim().toUpperCase())
      .filter(Boolean);

    logger.info('Fetching availability', { wings, url: DEFAULT_URL });

    const data = await scraper.scrapeSecureCafeAvailability(DEFAULT_URL, wings);

    res.json({
      success: true,
      data,
    });
  })
);

export default router;