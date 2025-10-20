import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { getEnabledBuildings, scraperConfig, secureCafeUrl } from '../config/scraper';
import dataService from '../services/DataService';
import { ScraperService } from '../services/ScraperService';

const router = Router();

// Simple in-memory flag to prevent overlapping runs
let running = false;

// Local wing filter (mirrors ScraperService private regex)
function filterByWings<T extends { name: string }>(items: T[], wings: string[]): T[] {
  if (!wings || wings.length === 0) return items;
  const wingSet = new Set(wings.map(w => w.trim().toUpperCase()));
  return items.filter(item => {
    const m = (item.name || '').toUpperCase().match(/\b([A-Z])[ -]?\d+\b/);
    const wing = m ? m[1] : undefined;
    return wing ? wingSet.has(wing) : false;
  });
}

// POST /api/scraper/run - Run full scrape now (Fairview + Boren), filter wings D,E, persist
router.post(
  '/run',
  asyncHandler(async (req: Request, res: Response) => {
    if (running) {
      return res.status(429).json({ success: false, message: 'Scrape already in progress' });
    }

    running = true;
    const startedAt = new Date();
    const wings: string[] = scraperConfig.defaultWings;
    const buildings = getEnabledBuildings();
    const scraper = new ScraperService();

    const perBuilding: Array<{
      name: string;
      url: string;
      scraped: number;
      filtered: number;
      persisted: { buildingId: number; upserted: number; priced: number } | null;
      errors: string[];
    }> = [];

    try {
      for (const b of buildings) {
        logger.info('Manual scrape run: starting building', { building: b.name, url: b.url, wings });

        const result = await scraper.scrapeBuilding({ name: b.name, url: b.url } as any);
        let plans = result.floorPlans.slice();

        // Business rule: missing price means not available
        plans = plans.map(p => ({ ...p, isAvailable: Number(p.price) > 0 }));

        // Only keep D/E plans based on name token heuristic
        const filtered = filterByWings(plans, wings);

        let persisted: { buildingId: number; upserted: number; priced: number } | null = null;
        if (filtered.length) {
          persisted = await dataService.persistScrapedFloorPlans(
            { name: b.name, url: b.url },
            filtered,
            result.timestamp
          );
        }

        perBuilding.push({
          name: b.name,
          url: b.url,
          scraped: plans.length,
          filtered: filtered.length,
          persisted: persisted,
          errors: result.errors
        });

        logger.info('Manual scrape run: building complete', {
          building: b.name,
          scraped: plans.length,
          filtered: filtered.length,
          persisted
        });
      }

      // Refresh SecureCafe availability cache (D/E wings) as part of manual run
      try {
        const scData = await scraper.scrapeSecureCafeAvailability(secureCafeUrl, wings);
        await dataService.setSecureCafeAvailabilityCache(
          scData,
          scData?.scrapedAt || new Date().toISOString()
        );
        logger.info('SecureCafe availability cache refreshed (manual run)', {
          nextMonth: (scData?.availableNextMonth || []).length,
          tableRows: (scData?.availableSoonTable?.rows || []).length
        });
      } catch (err: any) {
        logger.warn('SecureCafe cache refresh failed during manual run', { error: err?.message || String(err) });
      }

      const finishedAt = new Date();
      return res.json({
        success: true,
        data: {
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          buildings: perBuilding,
          totals: {
            scraped: perBuilding.reduce((a, b) => a + b.scraped, 0),
            filtered: perBuilding.reduce((a, b) => a + b.filtered, 0),
            upserted: perBuilding.reduce((a, b) => a + (b.persisted?.upserted || 0), 0),
            priced: perBuilding.reduce((a, b) => a + (b.persisted?.priced || 0), 0)
          }
        }
      });
    } catch (err: any) {
      logger.error('Manual scrape run failed', { error: err?.message || String(err) });
      return res.status(500).json({ success: false, error: 'Manual scrape failed' });
    } finally {
      running = false;
    }
  })
);

export default router;