import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import logger from '../utils/logger';
import { getEnabledBuildings, scraperConfig, secureCafeUrl } from '../config/scraper';
import { ScraperService } from './ScraperService';
import dataService from './DataService';

type ISODate = string;

export interface SchedulerRunSummary {
  startedAt: ISODate;
  finishedAt?: ISODate;
  buildingCount: number;
  upserted: number;
  priced: number;
  errors: string[];
}

export interface SchedulerStatus {
  running: boolean;
  lastRun?: SchedulerRunSummary | null;
  nextRun?: ISODate | null;
  timezone: string;
  schedules: string[]; // cron expressions
}

function toIso(d: Date): ISODate {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

function nextOccurrenceLocal(hour: number, minute: number, now = new Date()): Date {
  const n = new Date(now);
  const next = new Date(n);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (next <= n) {
    // Tomorrow
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export class SchedulerService {
  private tasks: ScheduledTask[] = [];
  private running = false;
  private lastRun: SchedulerRunSummary | null = null;
  private nextRun: ISODate | null = null;
  private readonly scraper = new ScraperService();
  private readonly tz: string;

  private readonly schedules = [
    '0 7 * * *',  // 07:00 local
    '0 19 * * *', // 19:00 local
  ];

  constructor(timezone?: string) {
    // Prefer explicit env TZ if set, else resolved local tz
    this.tz = timezone || process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  public getStatus(): SchedulerStatus {
    return {
      running: this.running,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      timezone: this.tz,
      schedules: this.schedules.slice(),
    };
  }

  public async start(): Promise<void> {
    if (this.tasks.length) return; // already scheduled
    // Precompute next run (earliest upcoming among schedules)
    await this.updateNextRun();

    for (const expr of this.schedules) {
      const task = cron.schedule(
        expr,
        async () => {
          await this.runOnce().catch((err) => {
            logger.error('Scheduled run failed', { error: err instanceof Error ? err.message : err });
          });
        },
        { timezone: this.tz }
      );
      this.tasks.push(task);
    }
    logger.info('SchedulerService started', { schedules: this.schedules, timezone: this.tz });
  }

  public async stop(): Promise<void> {
    for (const t of this.tasks) {
      try { t.stop(); } catch { /* noop */ }
    }
    this.tasks = [];
    logger.info('SchedulerService stopped');
  }

  public async runNow(): Promise<SchedulerRunSummary> {
    return this.runOnce();
  }

  private async runOnce(): Promise<SchedulerRunSummary> {
    if (this.running) {
      logger.warn('SchedulerService run requested while already running');
      return this.lastRun || {
        startedAt: toIso(new Date()),
        buildingCount: 0,
        upserted: 0,
        priced: 0,
        errors: ['Already running'],
      };
    }

    await dataService.init(); // ensure DB ready

    this.running = true;
    const started = new Date();
    const summary: SchedulerRunSummary = {
      startedAt: toIso(started),
      buildingCount: 0,
      upserted: 0,
      priced: 0,
      errors: [],
    };

    try {
      const buildings = getEnabledBuildings().filter(b => !!b.url);
      summary.buildingCount = buildings.length;

      for (const b of buildings) {
        try {
          const { result, persist } = await this.scraper.scrapeAndPersist({ id: 0 as any, name: b.name, url: b.url } as any);
          if (persist) {
            summary.upserted += persist.upserted;
            summary.priced += persist.priced;
          }
          if (!result.success) {
            summary.errors.push(`Scrape failed for ${b.name}: ${result.errors.join('; ')}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          summary.errors.push(`Error processing ${b.name}: ${msg}`);
          logger.error('SchedulerService building run error', { building: b.name, error: msg });
        }
      }

      // Refresh SecureCafe availability cache once per scheduled run
      try {
        const wings = scraperConfig.defaultWings;
        const scData = await this.scraper.scrapeSecureCafeAvailability(secureCafeUrl, wings);
        await dataService.setSecureCafeAvailabilityCache(
          scData,
          scData?.scrapedAt || new Date().toISOString()
        );
        logger.info('Scheduler refreshed SecureCafe availability cache', {
          nextMonth: (scData?.availableNextMonth || []).length,
          availableSoonUnits: (scData?.availableSoonUnits || []).length
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('Scheduler SecureCafe cache refresh failed', { error: msg });
      }
    } finally {
      const finished = new Date();
      summary.finishedAt = toIso(finished);
      this.running = false;
      this.lastRun = summary;

      // Update settings for last/next collection times
      try {
        await dataService.updateSetting('last_collection_time', summary.finishedAt || summary.startedAt);
        await this.updateNextRun(); // recompute and persist
      } catch (err) {
        logger.error('Failed to update scheduler settings', { error: err instanceof Error ? err.message : err });
      }
    }

    logger.info('SchedulerService run completed', {
      buildingCount: summary.buildingCount,
      upserted: summary.upserted,
      priced: summary.priced,
      errors: summary.errors.length,
    });

    return summary;
  }

  private async updateNextRun(): Promise<void> {
    // Compute earliest upcoming among both daily times, in local tz
    const now = new Date();
    const n1 = nextOccurrenceLocal(7, 0, now);
    const n2 = nextOccurrenceLocal(19, 0, now);
    const next = n1 <= n2 ? n1 : n2;
    this.nextRun = toIso(next);
    await dataService.updateSetting('next_collection_time', this.nextRun);
  }
}

// Singleton
export const schedulerService = new SchedulerService();
export default schedulerService;