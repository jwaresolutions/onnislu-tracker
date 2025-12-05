// ==UserScript==
// @name         ONNISLU Floor Plan Metadata Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Scrape floor plan metadata from ONNISLU websites
// @author       You
// @match        https://onnislu.com/floorplans/fairview
// @match        https://onnislu.com/floorplans/boren
// @match        https://onnislu.securecafe.com/onlineleasing/south-lake-union/oleapplication.aspx*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';

    // Parse bedroom count from plan type text
    function parseBedroomInfo(planType) {
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

    // Scrape ONNISLU floor plan pages (Fairview or Boren)
    function scrapeOnnisluPage() {
        const url = window.location.href;
        const building = url.includes('fairview') ? 'Fairview' : 'Boren';

        console.log(`Scraping ${building} floor plans...`);

        const plans = {};
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
                const { bedrooms, hasDen } = parseBedroomInfo(planType);
                plans[planName] = {
                    bedrooms,
                    bathrooms: 0, // Will be filled from SecureCafe
                    hasDen
                };
            }
        });

        console.log(`Found ${Object.keys(plans).length} plans for ${building}`);

        // Store in GM storage
        const existingData = GM_getValue('floorPlanData', {});
        existingData[building] = plans;
        GM_setValue('floorPlanData', existingData);

        console.log('Data saved to storage:', plans);
        alert(`✓ Scraped ${Object.keys(plans).length} ${building} floor plans!\n\nNow visit the other building page and SecureCafe page.`);
    }

    // Scrape SecureCafe bathroom info
    function scrapeSecureCafe() {
        console.log('Scraping SecureCafe bathroom info...');

        const bathroomData = [];
        const bodyText = document.body.innerText;
        const lines = bodyText.split('\n');

        for (const line of lines) {
            // Match pattern: "Floor Plan : [Building] [Plan] - X Bedroom, Y Bathroom"
            const match = line.match(/Floor Plan\s*:\s*(Boren|Fairview)\s+([A-Z0-9\*\-]+)\s*-\s*\d+\s*Bedroom,?\s*(\d+)\s*Bathroom/i);
            if (match) {
                const building = match[1];
                const planCode = match[2].toUpperCase();
                const bathrooms = parseInt(match[3]);

                bathroomData.push({
                    building,
                    planName: 'PLAN ' + planCode,
                    bathrooms
                });
            }
        }

        console.log(`Found bathroom info for ${bathroomData.length} plans`);

        // Apply bathroom data to stored plans
        const floorPlanData = GM_getValue('floorPlanData', {});

        bathroomData.forEach(data => {
            if (floorPlanData[data.building] && floorPlanData[data.building][data.planName]) {
                floorPlanData[data.building][data.planName].bathrooms = data.bathrooms;
                console.log(`Updated ${data.building} ${data.planName}: ${data.bathrooms} BA`);
            }
        });

        GM_setValue('floorPlanData', floorPlanData);

        console.log('Bathroom data applied');
        alert(`✓ Scraped bathroom info for ${bathroomData.length} floor plans!\n\nClick "Download JSON" button to get the data.`);
    }

    // Estimate missing bathrooms
    function estimateBathrooms(planName, bedrooms, buildingPlans) {
        // Rule 1: If similar plan exists (same letter), use that bathroom count
        const planLetter = planName.match(/PLAN ([A-Z])/)?.[1];
        if (planLetter) {
            for (const [otherPlan, meta] of Object.entries(buildingPlans)) {
                if (otherPlan.startsWith(`PLAN ${planLetter}`) && meta.bathrooms > 0) {
                    return meta.bathrooms;
                }
            }
        }

        // Rule 2: Assume bathrooms = bedrooms (minimum 1)
        return Math.max(bedrooms, 1);
    }

    // Create download button
    function createDownloadButton() {
        const button = document.createElement('button');
        button.textContent = '📥 Download Floor Plan JSON';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            padding: 12px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;

        button.addEventListener('click', () => {
            const floorPlanData = GM_getValue('floorPlanData', {});

            if (!floorPlanData.Fairview && !floorPlanData.Boren) {
                alert('No data found! Please visit the Fairview and Boren floor plan pages first.');
                return;
            }

            // Estimate missing bathrooms
            for (const [building, plans] of Object.entries(floorPlanData)) {
                for (const [planName, meta] of Object.entries(plans)) {
                    if (meta.bathrooms === 0) {
                        meta.bathrooms = estimateBathrooms(planName, meta.bedrooms, plans);
                    }
                }
            }

            // Create download
            const json = JSON.stringify(floorPlanData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'floor-plan-metadata.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('Downloaded:', floorPlanData);
            alert('✓ JSON file downloaded!\n\nSave it to: src/server/data/floor-plan-metadata.json');
        });

        button.addEventListener('mouseenter', () => {
            button.style.background = '#45a049';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = '#4CAF50';
        });

        document.body.appendChild(button);
    }

    // Create clear data button
    function createClearButton() {
        const button = document.createElement('button');
        button.textContent = '🗑️ Clear Data';
        button.style.cssText = `
            position: fixed;
            top: 50px;
            right: 10px;
            z-index: 10000;
            padding: 8px 16px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 12px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;

        button.addEventListener('click', () => {
            if (confirm('Clear all scraped data?')) {
                GM_deleteValue('floorPlanData');
                alert('✓ Data cleared!');
            }
        });

        button.addEventListener('mouseenter', () => {
            button.style.background = '#da190b';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = '#f44336';
        });

        document.body.appendChild(button);
    }

    // Main execution
    function init() {
        const url = window.location.href;

        // Add buttons to all pages
        createDownloadButton();
        createClearButton();

        // Auto-scrape based on page
        if (url.includes('onnislu.com/floorplans/fairview') || url.includes('onnislu.com/floorplans/boren')) {
            // Wait for page to load
            setTimeout(() => {
                const cards = document.querySelectorAll('.yard__card');
                if (cards.length > 0) {
                    scrapeOnnisluPage();
                }
            }, 1000);
        } else if (url.includes('securecafe.com')) {
            // Wait for page to load
            setTimeout(() => {
                scrapeSecureCafe();
            }, 2000);
        }
    }

    // Wait for page to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
