// Pure HTML parsing logic for floor plan scraping, suitable for unit tests (no Puppeteer required)
// Selectors come from config; no DOM lib types used to keep server TS config compatible.

import type { BuildingSelectorConfig } from '../../config/scraper';
import type { ScrapedFloorPlan } from '../ScraperService';

// Regexes aligned with ScraperService page.evaluate implementation
const PRICE_RE = /(?:from|starting at|start at|as low as)?\s*\$?\s*([\d,]+)(?:\.\d{2})?(?:\s*[-–]\s*\$?\s*([\d,]+)(?:\.\d{2})?)?/i;
const SQFT_RE = /(\d{3,4})\s*(?:sq\.?\s*ft|sf|square\s*feet)/i;
const BED_RE = /(studio)|(\d+)\s*bed/i;
const BATH_RE = /(\d+(?:\.\d+)?)\s*bath/i;

const textOf = (el: any): string =>
  (el && (el.innerText || el.textContent) || '').toString().trim();

const toAbs = (doc: any, src?: string | null, baseUrl?: string): string | undefined => {
  if (!src) return undefined;
  try {
    const base = baseUrl || (doc && doc.baseURI) || undefined;
    return new URL(src, base).toString();
  } catch {
    return undefined;
  }
};

// Create a document from HTML using existing global document if present.
// Tests can pass an injected Document via the injectDoc parameter to avoid environment coupling.
const getDocument = (html: string, injectDoc?: any): any => {
  if (injectDoc) return injectDoc;
  const gdoc: any = (globalThis as any).document;
  if (gdoc && typeof gdoc.createElement === 'function') {
    // Prefer creating a standalone HTMLDocument if available
    const impl = gdoc.implementation;
    if (impl && typeof impl.createHTMLDocument === 'function') {
      const nd = impl.createHTMLDocument('x');
      if (nd && nd.body) {
        nd.body.innerHTML = html;
        return nd as any;
      }
    }
    // Fallback to a detached element tree while retaining baseURI
    const div = gdoc.createElement('div');
    div.innerHTML = html;
    (div as any).baseURI = gdoc.baseURI;
    // Wrap in a minimal facade exposing querySelector(All) through the div
    return {
      baseURI: gdoc.baseURI,
      querySelector: div.querySelector.bind(div),
      querySelectorAll: div.querySelectorAll.bind(div)
    } as any;
  }
  // If no DOM available, caller must provide injectDoc
  throw new Error('No DOM available to parse HTML. Provide injectDoc from jsdom in tests.');
};

export function parseFloorPlansFromHtml(
  html: string,
  selConf: BuildingSelectorConfig,
  baseUrl?: string,
  injectDoc?: any
): ScrapedFloorPlan[] {
  const doc = getDocument(html, injectDoc);

  const itemSelectors = (selConf?.item || []).join(', ');
  const nameSelectors: string[] = selConf?.name || [];
  const priceSelectors: string[] = selConf?.price || [];
  const sqftSelectors: string[] = selConf?.sqft || [];
  const imageSelectors: string[] = selConf?.image || [];
  const include: string[] = (selConf?.availabilityInclude || []).map((s) => s.toLowerCase());
  const exclude: string[] = (selConf?.availabilityExclude || []).map((s) => s.toLowerCase());

  const nodes = Array.from((doc.querySelectorAll && doc.querySelectorAll(itemSelectors)) || []);

  const items: any[] = [];

  for (const el of nodes as any[]) {
    const text = textOf(el).replace(/\s+/g, ' ').trim();
    if (!text) continue;

    // Name via selectors, with fallbacks
    let name = '';
    for (const ns of nameSelectors) {
      const n = el.querySelector ? el.querySelector(ns) : null;
      const val = textOf(n);
      if (val) { name = val; break; }
    }
    if (!name) {
      name =
        textOf(el.querySelector?.('h1,h2,h3,h4,[data-testid*="name"],[class*="name"]')) ||
        el.querySelector?.('[aria-label]')?.getAttribute?.('aria-label') ||
        el.querySelector?.('img')?.getAttribute?.('alt') ||
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
    const bed = text.match(BED_RE);
    if (bed) bedrooms = bed[1] ? 0 : parseInt(bed[2] || '0', 10);
    else if (/studio/i.test(text)) bedrooms = 0;

    // Bathrooms
    let bathrooms = 1;
    const bath = text.match(BATH_RE);
    if (bath) bathrooms = parseFloat(bath[1]);

    // Den
    const hasDen = /\bden\b/i.test(text);

    // Square footage: targeted then fallback
    let squareFootage = 0;
    for (const ss of sqftSelectors) {
      const sEl = el.querySelector ? el.querySelector(ss) : null;
      const st = textOf(sEl);
      const m = st.match(SQFT_RE);
      if (m) { squareFootage = parseInt(m[1], 10); break; }
    }
    if (!squareFootage) {
      const sqft = text.match(SQFT_RE);
      if (sqft) squareFootage = parseInt(sqft[1], 10);
    }

    // Fallback name if still missing
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

    // Price: targeted then fallback
    let price = 0;
    let priceText = '';
    for (const ps of priceSelectors) {
      const pEl = el.querySelector ? el.querySelector(ps) : null;
      const pt = textOf(pEl);
      if (pt) { priceText = pt; break; }
    }
    if (!priceText) {
      priceText = text;
    }
    const pm = priceText.match(PRICE_RE);
    if (pm) {
      const a = pm[1] ? Number(pm[1].replace(/,/g, '')) : Number.POSITIVE_INFINITY;
      const b = pm[2] ? Number(pm[2].replace(/,/g, '')) : Number.POSITIVE_INFINITY;
      const cand = Math.min(a, b);
      if (Number.isFinite(cand)) price = cand;
    }

    // Availability using configured keywords
    const lt = text.toLowerCase();
    const isAvailable = include.length
      ? include.some(k => lt.includes(k)) && !exclude.some(k => lt.includes(k))
      : /available|apply|select/i.test(text) && !/waitlist|unavailable|sold\s*out/i.test(text);

    // Image via selectors then fallback
    let imageUrl: string | undefined;
    for (const is of imageSelectors) {
      const imgEl = el.querySelector ? el.querySelector(is) : null;
      const src = imgEl?.getAttribute?.('src') || imgEl?.getAttribute?.('data-src');
      const abs = toAbs(doc, src, baseUrl);
      if (abs) { imageUrl = abs; break; }
    }
    if (!imageUrl) {
      const img = el.querySelector ? el.querySelector('img') : null;
      imageUrl = toAbs(doc, img?.getAttribute?.('src') || img?.getAttribute?.('data-src'), baseUrl);
    }

    // Minimal signal
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

  return Array.from(map.values()) as ScrapedFloorPlan[];
}