// Migration runner script for ONNISLU
import { getDatabaseConnection } from '../database';
import { runMigrations } from '../database/migrations';

async function main() {
  try {
    const conn = getDatabaseConnection();
    const init = await conn.initialize();
    if (!init.success) {
      console.error('Database initialization failed:', init.error);
      process.exitCode = 1;
      return;
    }

    const db = conn.getDatabase();
    const result = await runMigrations(db);
    if (!result.success) {
      console.error('Migrations failed:', result.error);
      process.exitCode = 1;
      return;
    }

    const applied = result.data?.applied ?? 0;
    console.log(`Migrations completed. Applied: ${applied}`);
    process.exitCode = 0;
  } catch (err) {
    console.error('Migration script error:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main();