// Script to load floor plan metadata from JSON file into database
import fs from 'fs';
import path from 'path';
import { getDatabaseConnection } from '../database';
import logger from '../utils/logger';

interface FloorPlanMeta {
  bedrooms: number;
  bathrooms: number;
  hasDen: boolean;
}

interface MetadataFile {
  [building: string]: {
    [planName: string]: FloorPlanMeta;
  };
}

async function loadMetadata() {
  const conn = getDatabaseConnection();
  await conn.initialize();

  // Load JSON file
  const jsonPath = path.join(__dirname, '../data/floor-plan-metadata.json');
  const jsonData = fs.readFileSync(jsonPath, 'utf-8');
  const metadata: MetadataFile = JSON.parse(jsonData);

  let updated = 0;
  let notFound = 0;

  for (const [buildingName, plans] of Object.entries(metadata)) {
    for (const [planName, meta] of Object.entries(plans)) {
      try {
        // Find the floor plan in the database (match with or without asterisks)
        const result = await conn.executeQuery<{ id: number; name: string }>(
          `SELECT fp.id, fp.name
           FROM floor_plans fp 
           JOIN buildings b ON fp.building_id = b.id 
           WHERE (fp.name = ? OR fp.name = ? || '*' OR fp.name = ? || '**') AND b.name = ?
           LIMIT 1`,
          [planName, planName, planName, buildingName]
        );

        if (!result.success || !result.data || result.data.length === 0) {
          logger.warn(`Floor plan not found: ${planName} (${buildingName})`);
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
               bathrooms_estimated = 0
           WHERE id = ?`,
          [meta.bedrooms, meta.bathrooms, meta.hasDen ? 1 : 0, floorPlanId]
        );

        if (updateResult.success) {
          const changes = updateResult.data?.changes || 0;
          updated++;
          logger.info(
            `Updated ${planName} (${buildingName}): ${meta.bedrooms === 0 ? 'Studio' : `${meta.bedrooms} BR`}, ${meta.bathrooms} BA${meta.hasDen ? ' + Den' : ''} (${changes} rows changed)`
          );
        } else {
          logger.error(`Failed to update ${planName} (${buildingName}): ${updateResult.error}`);
        }
      } catch (error) {
        logger.error(`Error updating ${planName}:`, error);
      }
    }
  }

  logger.info(`Load complete: ${updated} updated, ${notFound} not found`);
  await conn.close();
}

loadMetadata()
  .then(() => {
    console.log('✓ Metadata loaded successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Metadata load failed:', error);
    process.exit(1);
  });
