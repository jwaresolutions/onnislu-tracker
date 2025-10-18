import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { ScraperService } from '../services/ScraperService';
import dataService from '../services/DataService';
import { scraperConfig, secureCafeUrl } from '../config/scraper';

const router = Router();
const scraper = new ScraperService();

const DEFAULT_URL = secureCafeUrl;

// GET /api/availability?wings=D,E
// Behavior:
// - Return cached DB-derived availability if any exists (no scraping)
// - If DB is empty (first-time), perform a single bootstrap scrape
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const wingsQuery = (req.query.wings as string) || '';
    const wings = (wingsQuery ? wingsQuery.split(',') : scraperConfig.defaultWings)
      .map((w) => w.trim().toUpperCase())
      .filter(Boolean);

    // Try cache from DB first for "Available Now", but still live-scrape "Available Next Month"
    try {
      const fpsRes = await dataService.getAllFloorPlans({ available_only: true });
      if (fpsRes.success) {
        const fps = (fpsRes.data as any[]) || [];
        if (fps.length > 0) {
          const availableNow = fps.map(fp => ({ name: String(fp.name) }));
          // Live scrape for future-dated units regardless of DB cache
          const live = await scraper.scrapeSecureCafeAvailability(DEFAULT_URL, wings);

          return res.json({
            success: true,
            data: {
              availableNow,
              availableNextMonth: live.availableNextMonth || [],
              ...(live as any).availableNextMonthUnits
                ? { availableNextMonthUnits: (live as any).availableNextMonthUnits }
                : {},
              availableSoonTable: (live as any).availableSoonTable || { headers: [], rows: [] },
              scrapedAt: live.scrapedAt,
              source: 'cache/db + scrape/live'
            }
          });
        }
      }
    } catch (e: any) {
      logger.warn('availability cache lookup failed', { error: e?.message || String(e) });
    }

    // DB empty — bootstrap scrape once
    logger.info('Fetching availability (bootstrap scrape)', { wings, url: DEFAULT_URL });
    const data = await scraper.scrapeSecureCafeAvailability(DEFAULT_URL, wings);
    return res.json({
      success: true,
      data
    });
  })
);

export default router;