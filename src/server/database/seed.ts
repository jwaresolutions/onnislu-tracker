// Seed script to insert buildings and default settings, and ensure schema via migrations
import { getDatabaseConnection } from '../database';
import { runMigrations } from './migrations';
import { getEnabledBuildings } from '../config/scraper';

async function main() {
  const conn = getDatabaseConnection();

  // Initialize DB and run migrations (creates schema and default rows if not present)
  const init = await conn.initialize();
  if (!init.success) {
    console.error('DB init failed:', init.error);
    process.exitCode = 1;
    return;
  }

  const db = conn.getDatabase();
  const mig = await runMigrations(db);
  if (!mig.success) {
    console.error('Migrations failed:', mig.error);
    process.exitCode = 1;
    return;
  }

  // Upsert buildings from environment config (only those with URLs configured)
  const enabled = getEnabledBuildings();
  let upserted = 0;
  for (const b of enabled) {
    try {
      // Insert if missing
      await conn.executeUpdate(
        'INSERT OR IGNORE INTO buildings (name, url) VALUES (?, ?)',
        [b.name, b.url]
      );
      // Always update URL to match env
      await conn.executeUpdate(
        'UPDATE buildings SET url = ? WHERE name = ?',
        [b.url, b.name]
      );
      upserted++;
    } catch (err) {
      console.error('Failed to upsert building', b.name, err);
    }
  }

  // Ensure default settings exist without overwriting user-changed values
  const defaultSettings: Array<[string, string]> = [
    ['alert_threshold_type', 'percentage'],
    ['alert_threshold_value', '5.0'],
    ['last_collection_time', ''],
    ['next_collection_time', '']
  ];
  for (const [key, value] of defaultSettings) {
    await conn.executeUpdate(
      'INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value]
    );
  }

  console.log('Seed completed', { buildingsProcessed: enabled.length, buildingsUpserted: upserted });
}

main().catch((e) => {
  console.error('Seed script error:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});