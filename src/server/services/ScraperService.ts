import puppeteer, { Browser, Page } from 'puppeteer';
import { Building, FloorPlan } from '../../shared/types';
import logger from '../utils/logger';
import { scraperConfig, getBuildingSelectors } from '../config/scraper';
import dataService from './DataService';

export interface ScrapedFloorPlan {
  name: string;
  bedrooms: number;
  bathrooms: number;
  hasDen: boolean;
  squareFootage: number;
  buildingPosition: string;
  price: number;
  isAvailable: boolean;
  imageUrl?: string;
}

export interface ScrapingResult {
  success: boolean;
  floorPlans: ScrapedFloorPlan[];
  errors: string[];
  timestamp: Date;
}

export class ScraperService {
  private browser: Browser | null = null;
  private readonly requestDelay = scraperConfig.crawlDelayMs;
  private readonly timeout = scraperConfig.timeoutMs;
  private readonly maxRetries = scraperConfig.maxRetries;

  constructor() {
    this.setupGracefulShutdown();
  }

  /**
   * Initialize the browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    try {
      // Make launch configurable for diverse environments (local macOS vs. container/CI)
      const headlessEnv = (process.env.PUPPETEER_HEADLESS || 'true').toLowerCase();
      const headless: boolean = headlessEnv !== 'false';

      // Use no-sandbox on Linux or when explicitly requested
      const noSandbox = process.env.PUPPETEER_NO_SANDBOX === 'true' || process.platform !== 'darwin';

      const args: string[] = [
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-accelerated-2d-canvas',
        '--ignore-certificate-errors'
      ];
      if (noSandbox) {
        args.unshift('--disable-setuid-sandbox');
        args.unshift('--no-sandbox');
      }

      const envExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
const defaultExecutablePath = typeof (puppeteer as any).executablePath === 'function'
  ? (puppeteer as any).executablePath()
  : undefined;
const executablePath = envExecutablePath || defaultExecutablePath;

const launchOptions: any = {
  headless,
  args,
  timeout: this.timeout, // launch timeout
  protocolTimeout: Math.max(this.timeout * 2, 60000), // CDP operations (Target.createTarget, etc.)
  ignoreHTTPSErrors: true
};
if (executablePath) {
  launchOptions.executablePath = executablePath;
}

      this.browser = await puppeteer.launch(launchOptions);

      logger.info('Browser initialized successfully', { headless, noSandbox, executablePath: !!executablePath });
      return this.browser;
    } catch (error) {
      logger.error('Failed to initialize browser', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Failed to initialize browser for scraping');
    }
  }

  /**
   * Close the browser instance
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.info('Browser closed successfully');
      } catch (error) {
        logger.error('Error closing browser:', error);
      }
    }
  }

  /**
   * Attach process signal handlers to close browser cleanly
   */
  private setupGracefulShutdown(): void {
    const shutdown = () => {
      this.closeBrowser().catch(err => logger.error('Error during browser shutdown', err));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('beforeExit', shutdown);
  }

  /**
   * Safely close a Puppeteer page; swallow benign TargetClose/Protocol errors
   */
  private async safeClosePage(page: Page | null, context: string): Promise<void> {
    if (!page) return;
    try {
      if (page.isClosed()) return;
    } catch {}
    try {
      const closePromise = page.close();
      await Promise.race([
        closePromise.catch(() => {}),
        new Promise<void>(resolve => setTimeout(resolve, 500))
      ]);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      if (/Protocol error|TargetCloseError|Connection closed/i.test(msg)) {
        logger.info('Ignoring benign page close error', { context, error: msg });
      } else {
        logger.warn('Page close failed', { context, error: msg });
      }
    }
  }

  /**
   * Create a new page with common settings
   */
  private async createPage(): Promise<Page> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    // Set user agent to appear as a regular browser
    await page.setUserAgent(scraperConfig.userAgent);

    // Extra headers for stability
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache'
    });

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Reduce payload: block heavy resources
    try {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const rt = req.resourceType();
        // Only block heavy assets; allow stylesheets, XHR/fetch, scripts, and 'other' to avoid breaking dynamic content
        if (rt === 'image' || rt === 'font' || rt === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });
    } catch {}

    // Set timeouts
    page.setDefaultTimeout(this.timeout);
    page.setDefaultNavigationTimeout(Math.max(this.timeout * 2, 60000));

    return page;
  }

  /**
   * Navigate to a URL with resilience against transient navigation issues
   * like "Navigating frame was detached" or "Execution context was destroyed".
   * Tries a few times with domcontentloaded, then validates DOM readiness.
   */
  private async navigateStable(page: Page, url: string): Promise<void> {
    const timeBudget = Math.max(this.timeout * 2, 60000);
    const attempts = 3;
    for (let i = 0; i < attempts; i++) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeBudget });
        await page.waitForSelector('body', { timeout: 30000 });
        // Ensure document is ready enough for queries
        await page.waitForFunction(
          () => {
            const d: any = (globalThis as any).document;
            return d && (d.readyState === 'interactive' || d.readyState === 'complete');
          },
          { timeout: 15000 }
        );
        // Small settle delay for SPAs replacing frames
        await page.waitForTimeout(500);
        return;
      } catch (err: any) {
        const msg = String(err?.message || err);
        const transient = /frame was detached|Execution context was destroyed|ERR_ABORTED/i.test(msg);
        logger.warn('navigateStable navigation error', { attempt: i + 1, transient, error: msg });
        if (i === attempts - 1) throw err;
        await page.waitForTimeout(1000 * (i + 1));
      }
    }
  }

  /**
   * Implement respectful scraping delay
   */
  private async delay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.requestDelay));
  }

  // Scroll down to trigger lazy-loaded content (images/lists) before extraction
  private async autoScroll(page: Page): Promise<void> {
    try {
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          const doc: any = (globalThis as any).document;
          const win: any = (globalThis as any);
          let totalHeight = 0;
          const distance = 400;

          const getScrollHeight = () => {
            if (!doc) return 0;
            const body = doc.body || {};
            const de = doc.documentElement || {};
            return Math.max(body.scrollHeight || 0, de.scrollHeight || 0);
          };

          const timer = setInterval(() => {
            const scrollHeight = getScrollHeight();
            if (win && typeof win.scrollBy === 'function') {
              win.scrollBy(0, distance);
            }
            totalHeight += distance;
            const innerH = win && win.innerHeight ? win.innerHeight : 0;
            if (totalHeight >= scrollHeight - innerH - 100) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
      });
    } catch {
      // Non-fatal
    }
  }
// Wait for any selector to appear to ensure listings are present
private async waitForAnySelector(page: Page, selectors: string[], timeoutMs: number): Promise<void> {
  try {
    await page.waitForFunction(
      (sels: string[]) => {
        const doc: any = (globalThis as any).document;
        if (!doc) return false;
        return sels.some((s) => !!doc.querySelector(s));
      },
      { timeout: timeoutMs },
      selectors
    );
  } catch {
    // Non-fatal; proceed best-effort
  }
}

  /**
   * Scrape floor plan data from a building's website
   */
  public async scrapeBuilding(building: Building): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      floorPlans: [],
      errors: [],
      timestamp: new Date()
    };

    let page: Page | null = null;
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        logger.info(`Scraping ${building.name} (attempt ${retryCount + 1}/${this.maxRetries})`);
        
        page = await this.createPage();
        
        // Navigate to the building's floor plans page (stable navigation with retries)
        await this.navigateStable(page, building.url);

                                // Wait for content to load
                                await page.waitForSelector('body', { timeout: 30000 });
                                // Use building-specific selectors from config, with broad fallback
                                const sel = getBuildingSelectors(building.name);
                                const fpSelectors = (sel.item && sel.item.length) ? sel.item : [
                                  '[data-testid*="floor"]',
                                  '[class*="floor"]',
                                  '[class*="plan"]',
                                  '[data-testid*="plan"]',
                                  '[data-qa*="floor"]',
                                  '[data-qa*="unit"]',
                                  '[data-qa*="plan"]',
                                  '.floorplan',
                                  '.FloorPlan',
                                  '[data-component*="FloorPlan"]',
                                  '.unit',
                                  '.unitcard',
                                  '.unit-card',
                                  '.apartment',
                                  '.apartment-card',
                                  '.card',
                                  '.listing',
                                  '.row',
                                  'article',
                                  'section',
                                  'li'
                                ];
                                await this.waitForAnySelector(page, fpSelectors, 10000);
                                await this.autoScroll(page);
                                await this.delay();

        // Extract floor plan data based on building
        const floorPlansRaw = await this.extractFloorPlans(page, building);
        const floorPlans = this.adaptForBuilding(building, floorPlansRaw);
        
        result.floorPlans = floorPlans;
        result.success = true;
        
        logger.info(`Successfully scraped ${floorPlans.length} floor plans from ${building.name}`);
        break;

      } catch (error) {
        retryCount++;
        const errorMessage = `Attempt ${retryCount} failed for ${building.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMessage);
        result.errors.push(errorMessage);

        if (retryCount < this.maxRetries) {
          // Exponential backoff
          const backoffDelay = Math.pow(2, retryCount) * 1000;
          logger.info(`Retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      } finally {
        await this.safeClosePage(page, 'scrapeBuilding');
      }
    }

    // Implement respectful delay between building scrapes
    await this.delay();

    return result;
  }

  /**
   * Extract floor plan data from the page
   * TODO: Implement site-specific parsing with DOM evaluation and selectors.
   */
  private async extractFloorPlans(page: Page, building: Building): Promise<ScrapedFloorPlan[]> {
    try {
      const selConf = getBuildingSelectors(building.name);
      const raw = await page.evaluate((selConf) => {
        const doc: any = (globalThis as any).document;
        if (!doc) return [] as any[];

        const itemSelectors = (selConf?.item || []).join(', ');

        const nameSelectors: string[] = selConf?.name || [];
        const priceSelectors: string[] = selConf?.price || [];
        const sqftSelectors: string[] = selConf?.sqft || [];
        const imageSelectors: string[] = selConf?.image || [];
        const include: string[] = (selConf?.availabilityInclude || []).map((s: string) => s.toLowerCase());
        const exclude: string[] = (selConf?.availabilityExclude || []).map((s: string) => s.toLowerCase());

        const toAbs = (src?: string | null): string | undefined => {
          if (!src) return undefined;
          try {
            return new URL(src, doc.baseURI).toString();
          } catch {
            return undefined;
          }
        };

        const nodes = Array.from(doc.querySelectorAll(itemSelectors)) as any[];

        const priceRegex = /(?:from|starting at|start at|as low as)?\s*\$?\s*([\d,]+)(?:\.\d{2})?(?:\s*[-–]\s*\$?\s*([\d,]+)(?:\.\d{2})?)?/i;
        const sqftRegex = /(\d{3,4})\s*(?:sq\.?\s*ft|sf|square\s*feet)/i;
        const bedRegex = /(studio)|(\d+)\s*bed/i;
        const bathRegex = /(\d+(?:\.\d+)?)\s*bath/i;

        const items: any[] = [];

        for (const el of nodes as any[]) {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (!text) continue;

          // Name via selectors, with fallbacks
          let name = '';
          for (const ns of nameSelectors) {
            const n = el.querySelector(ns) as any;
            const val = (n?.innerText || n?.textContent || '').trim();
            if (val) { name = val; break; }
          }
          if (!name) {
            name =
              (el.querySelector('h1,h2,h3,h4,[data-testid*="name"],[class*="name"]') as any)?.innerText?.trim() ||
              (el.querySelector('[aria-label]') as any)?.getAttribute('aria-label') ||
              (el.querySelector('img') as any)?.alt ||
              '';
          }
          if (!name) {
            const pc = text.match(/(?:plan|floor\s*plan)\s*([A-Z]?\d+[A-Z]?)/i);
            if (pc) name = `Plan ${pc[1]}`.trim();
          }
          if (!name) {
            const m = text.match(/([A-Za-z][A-Za-z0-9\-\s]{2,})/);
            if (m) name = m[1].trim();
          }
          name = String(name).replace(/\s+/g, ' ').trim();

          // Bedrooms
          let bedrooms = 0;
          const bed = text.match(bedRegex);
          if (bed) bedrooms = bed[1] ? 0 : parseInt(bed[2] || '0', 10);
          else if (/studio/i.test(text)) bedrooms = 0;

          // Bathrooms
          let bathrooms = 1;
          const bath = text.match(bathRegex);
          if (bath) bathrooms = parseFloat(bath[1]);

          // Den
          const hasDen = /\bden\b/i.test(text);

          // Square footage: targeted then fallback
          let squareFootage = 0;
          for (const ss of sqftSelectors) {
            const sEl = el.querySelector(ss) as any;
            const st = (sEl?.innerText || sEl?.textContent || '').trim();
            const m = st.match(sqftRegex);
            if (m) { squareFootage = parseInt(m[1], 10); break; }
          }
          if (!squareFootage) {
            const sqft = text.match(sqftRegex);
            if (sqft) squareFootage = parseInt(sqft[1], 10);
          }

          // Fallback name if missing: derive from beds/baths/sqft
          if (!name) {
            const bathLabel = Number.isFinite(bathrooms) ? (bathrooms as number) : 1;
            const bedLabel = bedrooms === 0 ? 'Studio' : `${bedrooms}x${bathLabel}`;
            const sqftLabel = squareFootage ? ` ${squareFootage} sf` : '';
            name = `${bedLabel}${sqftLabel}`.trim();
          }

          // Position/view
          let buildingPosition = '';
          const pos = text.match(/\b(north|south|east|west)\b.*?(?:view|facing)|\bcorner\b|\blake\b|\bcity\b/gi);
          if (pos && pos.length) buildingPosition = pos[0];

          // Price: targeted then fallback to broad search
          let price = 0;
          let priceText = '';
          for (const ps of priceSelectors) {
            const pEl = el.querySelector(ps) as any;
            const pt = (pEl?.innerText || pEl?.textContent || '').trim();
            if (pt) { priceText = pt; break; }
          }
          if (!priceText) {
            const priceEl = el.querySelector('[class*="price"],[data-testid*="price"],.rent,.amount') as any;
            priceText = (priceEl?.innerText || text).trim();
          }
          const pm = priceText.match(priceRegex);
          if (pm) {
            const a = pm[1] ? Number(pm[1].replace(/,/g, '')) : Number.POSITIVE_INFINITY;
            const b = pm[2] ? Number(pm[2].replace(/,/g, '')) : Number.POSITIVE_INFINITY;
            const cand = Math.min(a, b);
            if (Number.isFinite(cand)) price = cand;
          }

          // Availability using configured keywords if provided
          const lt = text.toLowerCase();
          let isAvailable = include.length
            ? include.some(k => lt.includes(k)) && !exclude.some(k => lt.includes(k))
            : /available|apply|select/i.test(text) && !/waitlist|unavailable|sold\s*out/i.test(text);

          // Image via selectors then fallback
          let imageUrl: string | undefined;
          for (const is of imageSelectors) {
            const imgEl = el.querySelector(is) as any;
            const src = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src');
            const abs = toAbs(src);
            if (abs) { imageUrl = abs; break; }
          }
          if (!imageUrl) {
            const img = el.querySelector('img') as any;
            imageUrl = toAbs(img?.getAttribute('src') || img?.getAttribute('data-src'));
          }

          // Minimal signal: either price or sqft
          if (!price && !squareFootage) continue;

          items.push({
            name,
            bedrooms,
            bathrooms,
            hasDen,
            squareFootage,
            buildingPosition,
            price,
            isAvailable,
            imageUrl
          });
        }

        // Deduplicate by name; keep lowest price observed
        const map = new Map<string, any>();
        for (const it of items) {
          const key = String(it.name).toUpperCase();
          const prev = map.get(key);
          if (!prev || (it.price && (!prev.price || it.price < prev.price))) {
            map.set(key, it);
          }
        }
        return Array.from(map.values());
      }, selConf);

      // Final sanitize/coerce on Node side
      return (raw as any[]).map((r) => ({
        name: String(r.name),
        bedrooms: Number.isFinite(r.bedrooms) ? r.bedrooms : 0,
        bathrooms: Number.isFinite(r.bathrooms) ? r.bathrooms : 1,
        hasDen: !!r.hasDen,
        squareFootage: Number.isFinite(r.squareFootage) ? r.squareFootage : 0,
        buildingPosition: String(r.buildingPosition || ''),
        price: Number.isFinite(r.price) ? r.price : 0,
        isAvailable: !!r.isAvailable,
        imageUrl: r.imageUrl || undefined
      }));
    } catch (error) {
      logger.error('extractFloorPlans error', { building: building.name, url: building.url, error });
      return [];
    }
  }

  /**
   * Filter items by wing code(s), e.g. D/E based on unit name text.
   */
  private filterByWings<T extends { name: string }>(items: T[], wings: string[]): T[] {
    if (!wings || wings.length === 0) return items;
    const wingSet = new Set(wings.map(w => w.trim().toUpperCase()));
    return items.filter(item => {
      // Heuristic: look for unit tokens like "D123" or "E-45" at word boundaries
      const match = item.name.toUpperCase().match(/\b([A-Z])[ -]?\d+\b/);
      const wing = match ? match[1] : undefined;
      return wing ? wingSet.has(wing) : false;
    });
  }

  /**
   * Scrape SecureCafe apartments page for availability,
   * returning D/E wings by default.
   */
  public async scrapeSecureCafeAvailability(
    url: string,
    wings: string[] = scraperConfig.defaultWings
  ): Promise<{
    availableNow: { name: string; moveInDate?: string }[];
    availableNextMonth: { name: string; moveInDate: string }[];
    scrapedAt: string;
    source: string;
  }> {
    let page: Page | null = null;
    try {
      page = await this.createPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: Math.max(this.timeout * 2, 60000) });
      await page.waitForSelector('body', { timeout: 30000 });
      const unitSelectors = [
        '[class*="unit"]',
        '[class*="Unit"]',
        '[data-testid*="unit"]',
        '.apartment',
        '.availability',
        '.unitcard',
        '.floorplan',
        'li',
        '.row'
      ];
      await this.waitForAnySelector(page, unitSelectors, 10000);
      await this.autoScroll(page);
      await this.delay();

      const rawUnits = await page.evaluate(() => {
        const doc: any = (globalThis as any).document;
        if (!doc) return [] as { name: string; moveInText: string }[];

        const selectors = [
          '[class*="unit"]',
          '[class*="Unit"]',
          '[data-testid*="unit"]',
          '.apartment',
          '.availability',
          '.unitcard',
          '.floorplan',
          'li',
          '.row'
        ].join(', ');

        const candidates = Array.from(doc.querySelectorAll(selectors)) as any[];
        const results: { name: string; moveInText: string }[] = [];
        const seen = new Set<string>();

        for (const el of candidates) {
          const text: string = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (!text) continue;

          // Unit name like D123 or E-456
          const nameMatch = text.match(/\b([A-Z])[-\s]?(\d{2,4})\b/);
          if (!nameMatch) continue;
          const unitName = `${nameMatch[1].toUpperCase()}${nameMatch[2]}`;
          if (seen.has(unitName)) continue;
          seen.add(unitName);

          const isNow = /available\s*now|move[-\s]?in\s*now|immediate/i.test(text);
          const dateMatch = text.match(
            /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i
          );

          const moveInText = isNow ? 'now' : (dateMatch ? dateMatch[0] : '');
          results.push({ name: unitName, moveInText });
        }

        return results;
      });

      type RawUnit = { name: string; moveInText: string };
      const parsed = (rawUnits as RawUnit[]) || [];
      const filtered = this.filterByWings(parsed, wings);

      const now = new Date();
      const nextMonth = (now.getMonth() + 1) % 12;
      const nextMonthYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();

      const toDate = (s?: string): Date | undefined => {
        if (!s) return undefined;
        const t = s.toLowerCase();
        if (t === 'now') return now;

        const d1 = new Date(s);
        if (!isNaN(d1.getTime())) return d1;

        const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (m) {
          const mm = parseInt(m[1], 10) - 1;
          const dd = parseInt(m[2], 10);
          let yyyy = parseInt(m[3], 10);
          if (yyyy < 100) yyyy += 2000;
          const d = new Date(yyyy, mm, dd);
          if (!isNaN(d.getTime())) return d;
        }
        return undefined;
      };

      const availableNow = filtered
        .filter(u => (u.moveInText || '').toLowerCase() === 'now')
        .map(u => ({ name: u.name, moveInDate: undefined }));

      const availableNextMonth = filtered
        .map(u => ({ name: u.name, date: toDate(u.moveInText) }))
        .filter(x => !!x.date && x.date!.getMonth() === nextMonth && x.date!.getFullYear() === nextMonthYear)
        .map(x => ({ name: x.name, moveInDate: x.date!.toISOString().slice(0, 10) }));

      return {
        availableNow,
        availableNextMonth,
        scrapedAt: new Date().toISOString(),
        source: url
      };
    } catch (error) {
      logger.error('scrapeSecureCafeAvailability error', { error });
      return {
        availableNow: [],
        availableNextMonth: [],
        scrapedAt: new Date().toISOString(),
        source: url
      };
    } finally {
      await this.safeClosePage(page, 'scrapeSecureCafeAvailability');
      await this.delay();
    }
  }

  // Normalize and adapt scraped plans per building-specific rules
  private adaptForBuilding(building: Building, plans: ScrapedFloorPlan[]): ScrapedFloorPlan[] {
    const bname = (building.name || '').toLowerCase();
    return plans.map(p => {
      let name = String(p.name || '').trim();
      if (bname.includes('fairview')) {
        name = name.replace(/\s*-\s*fairview/i, '').trim();
      }
      if (bname.includes('boren')) {
        name = name.replace(/\s*-\s*boren/i, '').trim();
      }
      return {
        ...p,
        name,
        bedrooms: Math.max(0, Math.round(Number.isFinite(p.bedrooms) ? (p.bedrooms as number) : 0)),
        bathrooms: Math.max(0, Number.isFinite(p.bathrooms) ? (p.bathrooms as number) : 1),
        squareFootage: Math.max(0, Math.round(Number.isFinite(p.squareFootage) ? (p.squareFootage as number) : 0)),
        buildingPosition: String(p.buildingPosition || '').trim()
      };
    });
  }

  // Scrape and persist in a single call
  public async scrapeAndPersist(building: Building): Promise<{
    result: ScrapingResult;
    persist: { buildingId: number; upserted: number; priced: number } | null;
  }> {
    const result = await this.scrapeBuilding(building);
    let persist: { buildingId: number; upserted: number; priced: number } | null = null;
    if (result.success && result.floorPlans.length) {
      try {
        persist = await dataService.persistScrapedFloorPlans(
          { name: building.name, url: building.url },
          result.floorPlans,
          result.timestamp
        );
      } catch (err) {
        logger.error('scrapeAndPersist persist failed', { building: building.name, error: err });
      }
    }
    return { result, persist };
  }
}