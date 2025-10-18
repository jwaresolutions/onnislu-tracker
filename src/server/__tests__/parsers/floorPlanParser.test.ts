import { JSDOM } from 'jsdom';
import { getBuildingSelectors } from '../../config/scraper';
import { parseFloorPlansFromHtml } from '../../services/parsers/floorPlanParser';

describe('parseFloorPlansFromHtml()', () => {
  const sel = getBuildingSelectors('Fairview');

  const html = `
    <div class="floorplan">
      <h3 class="name">Plan A1</h3>
      <div class="details">2 Bed · 2 Bath · 950 sq ft</div>
      <div class="price">Starting at $2,495</div>
      <div class="avail">Available Now</div>
      <img src="/img/a1.jpg" />
    </div>

    <div class="floorplan">
      <h3 class="name">Plan B2</h3>
      <div class="details">1 Bed · 1 Bath · 700 sq ft</div>
      <div class="price">From $1,995</div>
      <div class="avail">Waitlist</div>
      <img data-src="https://example.com/img/b2.jpg" />
    </div>

    <!-- Duplicate name with lower price, should dedupe to lowest -->
    <div class="floorplan">
      <h3 class="name">Plan B2</h3>
      <div class="details">1 Bed · 1 Bath · 700 sq ft</div>
      <div class="price">$1,895</div>
      <div class="avail">Apply</div>
    </div>
  `;

  it('parses floor plans with name, beds/baths, sqft, price, availability', () => {
    const dom = new JSDOM(`<base href="https://example.com/">${html}`);
    const doc = dom.window.document;

    const results = parseFloorPlansFromHtml(html, sel, 'https://example.com/', doc);

    expect(results.length).toBeGreaterThanOrEqual(2);

    const a1 = results.find(r => r.name.toLowerCase().includes('plan a1'));
    expect(a1).toBeTruthy();
    expect(a1!.bedrooms).toBe(2);
    expect(a1!.bathrooms).toBe(2);
    expect(a1!.squareFootage).toBe(950);
    expect(a1!.price).toBe(2495);
    expect(a1!.isAvailable).toBe(true);
    expect(a1!.imageUrl).toBe('https://example.com/img/a1.jpg');

    const b2 = results.find(r => r.name.toLowerCase().includes('plan b2'));
    expect(b2).toBeTruthy();
    expect(b2!.bedrooms).toBe(1);
    expect(b2!.bathrooms).toBe(1);
    expect(b2!.squareFootage).toBe(700);
    // Deduped to lowest price from duplicate entry
    expect(b2!.price).toBe(1895);
    // "Waitlist" entry should be excluded by exclude-logic for availability; duplicate has "Apply"
    expect(typeof b2!.isAvailable).toBe('boolean');
  });

  it('supports selector overrides for price-only nodes', () => {
    const override = {
      ...sel,
      price: ['.my-price']
    };
    const html2 = `
      <div class="floorplan">
        <h3>Plan C3</h3>
        <div class="my-price">$2,150</div>
        <div>Studio · 1 Bath · 500 sq ft</div>
      </div>
    `;
    const dom = new JSDOM(html2);
    const doc = dom.window.document;

    const results = parseFloorPlansFromHtml(html2, override, undefined, doc);
    const c3 = results.find(r => r.name.toLowerCase().includes('plan c3'));
    expect(c3).toBeTruthy();
    expect(c3!.bedrooms).toBe(0);
    expect(c3!.bathrooms).toBe(1);
    expect(c3!.squareFootage).toBe(500);
    expect(c3!.price).toBe(2150);
  });
});