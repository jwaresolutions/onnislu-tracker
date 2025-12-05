#!/usr/bin/env ts-node
/**
 * Local script to scrape floor plan metadata from ONNISLU websites
 * Run this OUTSIDE Docker on your local machine: npm run scrape:metadata
 * 
 * This script:
 * 1. Scrapes bedroom/den info from onnislu.com/floorplans/fairview and /boren
 * 2. Scrapes bathroom info from SecureCafe
 * 3. Estimates missing bathroom counts using the rules provided
 * 4. Outputs to src/server/data/floor-plan-metadata.json
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

interface FloorPlanMeta {
  bedrooms: number;
  bathrooms: number;
  hasDen: boolean;
  bathroomsEstimated?: boolean;
}

interface BuildingPlans {
  [planName: string]: FloorPlanMeta;
}

interface MetadataFile {
  Fairview: BuildingPlans;
  Boren: BuildingPlans;
}

const URLS = {
  fairview: 'https://onnislu.com/floorplans/fairview',
  boren: 'https://onnislu.com/floorplans/boren',
  securecafe: 'https://onnislu.securecafe.com/onlineleasing/south-lake-union/oleapplication.aspx?stepname=Apartments&myOlePropertyId=1087755'
};

/**
 * Parse bedroom count from plan type text
 * Examples: "URBAN 1 BR" -> 0, "1 BR" -> 1, "2 BR + DEN" -> 2
 */
function parseBedroomInfo(planType: string): { bedrooms: number; hasDen: boolean } {
  const text = planType.toUpperCase().trim();
  
  // Urban 1 BR is actually a studio (0 bedrooms)
  if (text.includes('URBAN')) {
    return { bedrooms: 0, hasDen: false };
  }
  
  // Check for den
  const hasDen = text.includes('DEN');
  
  // Extract bedroom count
  const match = text.match(/(\d+)\s*BR/);
  const bedrooms = match ? parseInt(match[1]) : 0;
  
  return { bedrooms, hasDen };
}

/**
 * Scrape floor plans from ONNISLU website
 */
async function scrapeOnnisluPlans(url: string, buildingName: string): Promise<BuildingPlans> {
  console.log(`\nScraping ${buildingName} from ${url}...`);
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract floor plan data from the page
    const plans = await page.evaluate(() => {
      const results: { [key: string]: { planType: string } } = {};
      
      // Find all floor plan cards
      const cards = document.querySelectorAll('.yard__card');
      
      cards.forEach(card => {
        // Get plan name (e.g., "A1", "B2", "C1")
        const planNameEl = card.querySelector('.content--yard h2');
        if (!planNameEl) return;
        
        const planText = planNameEl.textContent || '';
        const planMatch = planText.match(/plan\s+([A-Z0-9\*\-]+)/i);
        if (!planMatch) return;
        
        const planName = 'PLAN ' + planMatch[1].toUpperCase();
        
        // Get plan type (e.g., "1 BR", "1 BR + DEN", "URBAN 1 BR")
        const planTypeEl = card.querySelector('.content--yard p');
        const planType = planTypeEl?.textContent?.trim() || '';
        
        if (planType) {
          results[planName] = { planType };
        }
      });
      
      return results;
    });
    
    console.log(`Found ${Object.keys(plans).length} floor plans for ${buildingName}`);
    
    // Parse the data
    const buildingPlans: BuildingPlans = {};
    for (const [planName, data] of Object.entries(plans)) {
      const { bedrooms, hasDen } = parseBedroomInfo(data.planType);
      buildingPlans[planName] = {
        bedrooms,
        bathrooms: 0, // Will be filled in later
        hasDen,
        bathroomsEstimated: true
      };
      console.log(`  ${planName}: ${bedrooms === 0 ? 'Studio' : `${bedrooms} BR`}${hasDen ? ' + Den' : ''}`);
    }
    
    return buildingPlans;
  } finally {
    await browser.close();
  }
}

/**
 * Scrape bathroom info from SecureCafe
 */
async function scrapeBathroomInfo(): Promise<Map<string, { building: string; bathrooms: number }>> {
  console.log(`\nScraping bathroom info from SecureCafe...`);
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(URLS.securecafe, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);
    
    // Extract bathroom data
    const bathroomData = await page.evaluate(() => {
      const results: Array<{ planName: string; building: string; bathrooms: number }> = [];
      
      // Look for text patterns like "Floor Plan : Boren B1 - 1 Bedroom, 1 Bathroom"
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n');
      
      for (const line of lines) {
        // Match pattern: "Floor Plan : [Building] [Plan] - X Bedroom, Y Bathroom"
        const match = line.match(/Floor Plan\s*:\s*(Boren|Fairview)\s+([A-Z0-9\*\-]+)\s*-\s*\d+\s*Bedroom,\s*(\d+)\s*Bathroom/i);
        if (match) {
          const building = match[1];
          const planCode = match[2].toUpperCase();
          const bathrooms = parseInt(match[3]);
          
          results.push({
            planName: 'PLAN ' + planCode,
            building,
            bathrooms
          });
        }
      }
      
      return results;
    });
    
    console.log(`Found bathroom info for ${bathroomData.length} floor plans`);
    
    const bathroomMap = new Map<string, { building: string; bathrooms: number }>();
    for (const data of bathroomData) {
      const key = `${data.building}:${data.planName}`;
      bathroomMap.set(key, { building: data.building, bathrooms: data.bathrooms });
      console.log(`  ${data.building} ${data.planName}: ${data.bathrooms} BA`);
    }
    
    return bathroomMap;
  } catch (error) {
    console.warn('Warning: Could not scrape SecureCafe (may require login or have anti-bot protection)');
    console.warn('Will use estimation rules for all bathroom counts');
    return new Map();
  } finally {
    await browser.close();
  }
}

/**
 * Estimate bathrooms using the rules provided
 */
function estimateBathrooms(
  planName: string,
  bedrooms: number,
  buildingPlans: BuildingPlans
): number {
  // Rule 1: If similar plan exists (same letter), use that bathroom count
  const planLetter = planName.match(/PLAN ([A-Z])/)?.[1];
  if (planLetter) {
    for (const [otherPlan, meta] of Object.entries(buildingPlans)) {
      if (otherPlan.startsWith(`PLAN ${planLetter}`) && 
          meta.bathrooms > 0 && 
          !meta.bathroomsEstimated) {
        return meta.bathrooms;
      }
    }
  }
  
  // Rule 2: Assume bathrooms = bedrooms (minimum 1)
  return Math.max(bedrooms, 1);
}

/**
 * Main scraping function
 */
async function scrapeMetadata() {
  console.log('Starting floor plan metadata scraping...\n');
  
  try {
    // Scrape bedroom/den info from both buildings
    const fairviewPlans = await scrapeOnnisluPlans(URLS.fairview, 'Fairview');
    const borenPlans = await scrapeOnnisluPlans(URLS.boren, 'Boren');
    
    // Scrape bathroom info from SecureCafe
    const bathroomInfo = await scrapeBathroomInfo();
    
    // Apply bathroom data where available
    console.log('\nApplying bathroom data...');
    for (const [building, plans] of [['Fairview', fairviewPlans], ['Boren', borenPlans]] as const) {
      for (const [planName, meta] of Object.entries(plans)) {
        const key = `${building}:${planName}`;
        const bathroomData = bathroomInfo.get(key);
        
        if (bathroomData) {
          meta.bathrooms = bathroomData.bathrooms;
          meta.bathroomsEstimated = false;
          console.log(`  ${building} ${planName}: ${bathroomData.bathrooms} BA (from SecureCafe)`);
        }
      }
    }
    
    // Estimate missing bathrooms
    console.log('\nEstimating missing bathroom counts...');
    for (const [building, plans] of [['Fairview', fairviewPlans], ['Boren', borenPlans]] as const) {
      for (const [planName, meta] of Object.entries(plans)) {
        if (meta.bathrooms === 0) {
          meta.bathrooms = estimateBathrooms(planName, meta.bedrooms, plans);
          meta.bathroomsEstimated = true;
          console.log(`  ${building} ${planName}: ${meta.bathrooms} BA (estimated)`);
        }
      }
    }
    
    // Create final metadata object
    const metadata: MetadataFile = {
      Fairview: fairviewPlans,
      Boren: borenPlans
    };
    
    // Write to file
    const outputPath = path.join(__dirname, '../data/floor-plan-metadata.json');
    fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
    
    console.log(`\n✓ Metadata written to ${outputPath}`);
    console.log('\nSummary:');
    console.log(`  Fairview: ${Object.keys(fairviewPlans).length} plans`);
    console.log(`  Boren: ${Object.keys(borenPlans).length} plans`);
    
    const totalEstimated = Object.values(fairviewPlans).filter(p => p.bathroomsEstimated).length +
                          Object.values(borenPlans).filter(p => p.bathroomsEstimated).length;
    console.log(`  Bathrooms estimated: ${totalEstimated}`);
    
  } catch (error) {
    console.error('Error scraping metadata:', error);
    process.exit(1);
  }
}

// Run the scraper
scrapeMetadata()
  .then(() => {
    console.log('\n✓ Scraping complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Scraping failed:', error);
    process.exit(1);
  });
