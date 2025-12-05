// Script to scrape and update bedroom, bathroom, and den metadata for floor plans
import puppeteer, { Browser, Page } from 'puppeteer';
import { getDatabaseConnection } from '../database';
import logger from '../utils/logger';

interface FloorPlanMetadata {
  name: string;
  bedrooms: number;
  bathrooms: number;
  hasDen: boolean;
  bathroomsEstimated: boolean; // true if bathroom count is a guess
  building?: string;
}

class FloorPlanMetadataUpdater {
  private browser: Browser | null = null;

  async init() {
    this.browser = await puppeteer.launch({
      headless: 'new' as any,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async createPage(): Promise<Page> {
    if (!this.browser) throw new Error('Browser not initialized');
    const page = await this.browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    return page;
  }

  /**
   * Scrape bedroom and den info from onnislu.com/floorplans pages
   */
  async scrapeOnnisluFloorplans(url: string, buildingName: string): Promise<FloorPlanMetadata[]> {
    const page = await this.createPage();
    const results: FloorPlanMetadata[] = [];

    try {
      logger.info(`Scraping ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('body', { timeout: 30000 });

      // Scroll to load all content
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 400;
          const timer = setInterval(() => {
            const scrollHeight = Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight
            );
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight - window.innerHeight - 100) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
      });

      // Extract floor plan tiles
      const plans = await page.evaluate((building) => {
        const results: any[] = [];
        
        // Look for floor plan tiles/cards
        const tiles = Array.from(document.querySelectorAll('[class*="floor"], [class*="plan"], .card, article, section'));
        
        for (const tile of tiles) {
          const text = (tile.textContent || '').replace(/\s+/g, ' ').trim();
          
          // Extract plan name (e.g., "PLAN A1", "A1", etc.)
          const nameMatch = text.match(/(?:PLAN\s+)?([A-Z]+\d+[A-Z]?)/i);
          if (!nameMatch) continue;
          
          const planName = `PLAN ${nameMatch[1].toUpperCase()}`;
          
          // Extract bedrooms and den from patterns like "1 BR", "1 BR + DEN", "STUDIO", "STUDIO + DEN"
          let bedrooms = 0;
          let hasDen = false;
          
          // Check for studio
          if (/\bSTUDIO\b/i.test(text)) {
            bedrooms = 0;
          } else {
            // Look for bedroom count
            const brMatch = text.match(/(\d+)\s*BR\b/i);
            if (brMatch) {
              bedrooms = parseInt(brMatch[1], 10);
            }
          }
          
          // Check for den
          if (/\+\s*DEN\b/i.test(text) || /\bDEN\b/i.test(text)) {
            hasDen = true;
          }
          
          // Only add if we found bedroom info
          if (nameMatch) {
            results.push({
              name: planName,
              bedrooms,
              hasDen,
              building
            });
          }
        }
        
        return results;
      }, buildingName);

      results.push(...plans);
      logger.info(`Found ${plans.length} floor plans from ${url}`);
    } catch (error) {
      logger.error(`Error scraping ${url}:`, error);
    } finally {
      await page.close();
    }

    return results;
  }

  /**
   * Scrape bathroom info from SecureCafe availability page
   */
  async scrapeSecureCafeBathrooms(url: string): Promise<Map<string, { bathrooms: number; building: string }>> {
    const page = await this.createPage();
    const bathroomMap = new Map<string, { bathrooms: number; building: string }>();

    try {
      logger.info(`Scraping bathrooms from ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('body', { timeout: 30000 });

      // Scroll to load all content
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 400;
          const timer = setInterval(() => {
            const scrollHeight = Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight
            );
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight - window.innerHeight - 100) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
      });

      // Extract floor plan bathroom info
      const bathroomData = await page.evaluate(() => {
        const results: any[] = [];
        const text = document.body.textContent || '';
        
        // Look for patterns like "Floor Plan : Boren B1 - 1 Bedroom, 1 Bathroom"
        const regex = /Floor\s+Plan\s*:\s*(Boren|Fairview)\s+([A-Z]+\d+[A-Z]?)\s*-\s*\d+\s*Bedroom,\s*(\d+(?:\.\d+)?)\s*Bathroom/gi;
        
        let match;
        while ((match = regex.exec(text)) !== null) {
          const building = match[1];
          const planCode = match[2].toUpperCase();
          const bathrooms = parseFloat(match[3]);
          
          results.push({
            planName: `PLAN ${planCode}`,
            bathrooms,
            building
          });
        }
        
        return results;
      });

      for (const data of bathroomData) {
        bathroomMap.set(data.planName, {
          bathrooms: data.bathrooms,
          building: data.building
        });
      }

      logger.info(`Found bathroom data for ${bathroomMap.size} floor plans`);
    } catch (error) {
      logger.error(`Error scraping bathrooms from ${url}:`, error);
    } finally {
      await page.close();
    }

    return bathroomMap;
  }

  /**
   * Estimate bathrooms based on similar plans or bedroom count
   */
  estimateBathrooms(
    planName: string,
    bedrooms: number,
    bathroomMap: Map<string, { bathrooms: number; building: string }>
  ): { bathrooms: number; estimated: boolean } {
    // Check if we have exact data
    if (bathroomMap.has(planName)) {
      return { bathrooms: bathroomMap.get(planName)!.bathrooms, estimated: false };
    }

    // Extract plan letter (e.g., "A" from "PLAN A1")
    const letterMatch = planName.match(/PLAN\s+([A-Z]+)/i);
    if (letterMatch) {
      const letter = letterMatch[1].toUpperCase();
      
      // Look for any plan with the same letter
      for (const [key, value] of bathroomMap.entries()) {
        if (key.startsWith(`PLAN ${letter}`)) {
          logger.info(`Estimating bathrooms for ${planName} based on ${key}: ${value.bathrooms}`);
          return { bathrooms: value.bathrooms, estimated: true };
        }
      }
    }

    // Fallback: assume bathrooms = bedrooms (with minimum of 1)
    const estimated = Math.max(1, bedrooms);
    logger.info(`Estimating bathrooms for ${planName} based on bedrooms: ${estimated}`);
    return { bathrooms: estimated, estimated: true };
  }

  /**
   * Update database with scraped metadata
   */
  async updateDatabase(metadata: FloorPlanMetadata[]) {
    const conn = getDatabaseConnection();
    await conn.initialize();

    let updated = 0;
    let notFound = 0;

    for (const plan of metadata) {
      try {
        // Find the floor plan in the database
        const result = await conn.executeQuery<{ id: number; building_id: number }>(
          `SELECT fp.id, fp.building_id 
           FROM floor_plans fp 
           JOIN buildings b ON fp.building_id = b.id 
           WHERE fp.name = ? 
           ${plan.building ? 'AND b.name = ?' : ''}
           LIMIT 1`,
          plan.building ? [plan.name, plan.building] : [plan.name]
        );

        if (!result.success || !result.data || result.data.length === 0) {
          logger.warn(`Floor plan not found in database: ${plan.name}${plan.building ? ` (${plan.building})` : ''}`);
          notFound++;
          continue;
        }

        const floorPlanId = result.data[0].id;

        // Update the floor plan
        const updateResult = await conn.executeUpdate(
          `UPDATE floor_plans 
           SET bedrooms = ?, 
               bathrooms = ?, 
               has_den = ?,
               bathrooms_estimated = ?
           WHERE id = ?`,
          [plan.bedrooms, plan.bathrooms, plan.hasDen ? 1 : 0, plan.bathroomsEstimated ? 1 : 0, floorPlanId]
        );

        if (updateResult.success) {
          updated++;
          logger.info(
            `Updated ${plan.name}: ${plan.bedrooms} BR, ${plan.bathrooms} BA${plan.hasDen ? ' + DEN' : ''}${plan.bathroomsEstimated ? ' (bathrooms estimated)' : ''}`
          );
        }
      } catch (error) {
        logger.error(`Error updating ${plan.name}:`, error);
      }
    }

    logger.info(`Update complete: ${updated} updated, ${notFound} not found`);
    await conn.close();
  }

  /**
   * Main execution
   */
  async run() {
    try {
      await this.init();

      // Step 1: Scrape bedroom and den info from onnislu.com
      const fairviewPlans = await this.scrapeOnnisluFloorplans(
        'https://onnislu.com/floorplans/fairview',
        'Fairview'
      );
      const borenPlans = await this.scrapeOnnisluFloorplans(
        'https://onnislu.com/floorplans/boren',
        'Boren'
      );

      // Step 2: Scrape bathroom info from SecureCafe
      const bathroomMap = await this.scrapeSecureCafeBathrooms(
        'https://onnislu.securecafe.com/onlineleasing/south-lake-union/oleapplication.aspx?stepname=Apartments&myOlePropertyId=1087755'
      );

      // Step 3: Combine data and estimate missing bathrooms
      const allPlans = [...fairviewPlans, ...borenPlans];
      const completeMetadata: FloorPlanMetadata[] = allPlans.map(plan => {
        const bathroomInfo = this.estimateBathrooms(plan.name, plan.bedrooms, bathroomMap);
        return {
          ...plan,
          bathrooms: bathroomInfo.bathrooms,
          bathroomsEstimated: bathroomInfo.estimated
        };
      });

      // Step 4: Update database
      await this.updateDatabase(completeMetadata);

      logger.info('Floor plan metadata update complete!');
    } catch (error) {
      logger.error('Error in metadata update:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Run the script
const updater = new FloorPlanMetadataUpdater();
updater.run()
  .then(() => {
    console.log('✓ Metadata update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Metadata update failed:', error);
    process.exit(1);
  });
