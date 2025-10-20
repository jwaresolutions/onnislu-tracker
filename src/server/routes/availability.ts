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

    // Try cache from DB first (Available Now) + SecureCafe availability (with 24h freshness)
    try {
      const fpsRes = await dataService.getAllFloorPlans({ available_only: true });
      if (fpsRes.success) {
        const fps = (fpsRes.data as any[]) || [];
        if (fps.length > 0) {
          const availableNow = fps.map(fp => ({ name: String(fp.name) }));
          const lastSetting = await dataService.getSetting('last_collection_time');
          const scrapedAtDb =
            (lastSetting.success && (lastSetting.data as any)?.value)
              ? String((lastSetting.data as any).value)
              : new Date().toISOString();

          // Load SecureCafe cache
          const cache = await dataService.getSecureCafeAvailabilityCache();
          const now = Date.now();
          const cacheTimeMs = cache.time ? Date.parse(cache.time) : 0;
          const isFresh = cacheTimeMs > 0 && (now - cacheTimeMs) <= 24 * 60 * 60 * 1000;

          let scData: any | null = isFresh ? (cache.data || null) : null;

          // If no cache or stale (>24h), scrape now and cache it
          if (!scData) {
            try {
              const wingsQuery = (req.query.wings as string) || '';
              const wings = (wingsQuery ? wingsQuery.split(',') : scraperConfig.defaultWings)
                .map((w) => w.trim().toUpperCase())
                .filter(Boolean);
              logger.info('Refreshing SecureCafe availability cache', { wings, url: DEFAULT_URL });
              scData = await scraper.scrapeSecureCafeAvailability(DEFAULT_URL, wings);
              await dataService.setSecureCafeAvailabilityCache(scData, scData?.scrapedAt || new Date().toISOString());
            } catch (err: any) {
              logger.warn('SecureCafe scrape for cache failed; proceeding with DB-only', { error: err?.message || String(err) });
              scData = null;
            }
          }

          const payload: any = {
            availableNow,
            availableNextMonth: Array.isArray(scData?.availableNextMonth) ? scData.availableNextMonth : [],
            scrapedAt: scData?.scrapedAt || cache.time || scrapedAtDb,
            source: scData ? 'cache/db+securecafe' : 'cache/db'
          };

          // Pass through normalized table and rich units when available
          if (scData?.availableSoonTable) payload.availableSoonTable = scData.availableSoonTable;
          if (scData?.availableNextMonthUnits) payload.availableNextMonthUnits = scData.availableNextMonthUnits;

          return res.json({ success: true, data: payload });
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