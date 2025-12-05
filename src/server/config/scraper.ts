// Centralized scraper configuration for buildings and runtime
// Do not hardcode environment values elsewhere; import from this module.

export interface BuildingConfig {
  name: string;
  url: string;
}

export interface ScraperRuntimeConfig {
  userAgent: string;
  crawlDelayMs: number;
  timeoutMs: number;
  maxRetries: number;
  defaultWings: string[];
  respectRobotsTxt: boolean;
}

const env = (k: string, d?: string) =>
  (process.env[k] && process.env[k]!.trim().length > 0 ? process.env[k]!.trim() : d ?? '');

const envInt = (k: string, d: number) => {
  const v = parseInt(env(k) || '', 10);
  return Number.isFinite(v) ? v : d;
};

const envList = (k: string, d: string[]) => {
  const v = env(k);
  return v ? v.split(',').map(s => s.trim()).filter(Boolean) : d;
};

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const scraperConfig: ScraperRuntimeConfig = {
  userAgent: env('SCRAPER_USER_AGENT', DEFAULT_UA),
  crawlDelayMs: envInt('SCRAPER_CRAWL_DELAY_MS', 2000),
  timeoutMs: envInt('SCRAPER_TIMEOUT_MS', 30000),
  maxRetries: envInt('SCRAPER_MAX_RETRIES', 3),
  defaultWings: envList('DEFAULT_WINGS', []), // Empty array = all wings
  respectRobotsTxt: env('SCRAPER_RESPECT_ROBOTS', 'true').toLowerCase() !== 'false',
};

export const buildings: BuildingConfig[] = [
  {
    name: 'Fairview',
    url: env(
      'BUILDING_FAIRVIEW_URL',
      'https://onnislu.com/floorplans/fairview'
    )
  },
  {
    name: 'Boren',
    url: env(
      'BUILDING_BOREN_URL',
      'https://onnislu.com/floorplans/boren'
    )
  },
];

export const secureCafeUrl = env(
  'SECURECAFE_URL',
  'https://onnislu.securecafe.com/onlineleasing/south-lake-union/oleapplication.aspx?stepname=Apartments&myOlePropertyId=1087755'
);

export const getEnabledBuildings = (): BuildingConfig[] => buildings.filter(b => !!b.url);

// Selector config for building-specific scraping
export interface BuildingSelectorConfig {
  item: string[];                // selectors to locate each floor plan/item node
  name: string[];                // selectors to extract plan name
  price: string[];               // selectors to extract price text
  sqft: string[];                // selectors to extract square footage
  image: string[];               // selectors to extract image src/data-src
  availabilityInclude: string[]; // keywords indicating availability
  availabilityExclude: string[]; // keywords indicating not available/waitlist
}

// Default SecureCafe-ish selectors (broad but safe)
const defaultSelectors: BuildingSelectorConfig = {
  item: [
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
  ],
  name: ['h1', 'h2', 'h3', 'h4', '[data-testid*="name"]', '[class*="name"]', '[aria-label]'],
  price: ['[class*="price"]', '[data-testid*="price"]', '.rent', '.amount'],
  sqft: ['[class*="sqft"]', '[data-testid*="sqft"]'],
  image: ['img'],
  availabilityInclude: ['available', 'apply', 'select'],
  availabilityExclude: ['waitlist', 'unavailable', 'sold out']
};

// Per-building overrides (can be extended without changing service code)
const buildingSelectorOverrides: Record<string, Partial<BuildingSelectorConfig>> = {
  // tightened selectors for onnislu.com floorplan cards
  fairview: {
    item: ['.floorplan', '.floor-plan', '.floorplan-card', '.card', 'article', 'li'],
    name: ['.title', '.name', 'h2', 'h3', '[aria-label]'],
    price: ['.price', '.rent', '.amount', '[data-testid*="price"]'],
    sqft: ['.sqft', '.square-feet', '[data-testid*="sqft"]'],
    image: ['img']
  },
  boren: {
    item: ['.floorplan', '.floor-plan', '.floorplan-card', '.card', 'article', 'li'],
    name: ['.title', '.name', 'h2', 'h3', '[aria-label]'],
    price: ['.price', '.rent', '.amount', '[data-testid*="price"]'],
    sqft: ['.sqft', '.square-feet', '[data-testid*="sqft"]'],
    image: ['img']
  }
};

export const getBuildingSelectors = (buildingName: string): BuildingSelectorConfig => {
  const key = (buildingName || '').trim().toLowerCase();
  const o = buildingSelectorOverrides[key] || {};
  return {
    item: o.item || defaultSelectors.item,
    name: o.name || defaultSelectors.name,
    price: o.price || defaultSelectors.price,
    sqft: o.sqft || defaultSelectors.sqft,
    image: o.image || defaultSelectors.image,
    availabilityInclude: o.availabilityInclude || defaultSelectors.availabilityInclude,
    availabilityExclude: o.availabilityExclude || defaultSelectors.availabilityExclude
  };
};
