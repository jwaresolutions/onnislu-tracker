import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { DatabaseResult } from '../../shared/types/database';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export class MigrationManager {
  private db: Database<sqlite3.Database, sqlite3.Statement>;

  constructor(db: Database<sqlite3.Database, sqlite3.Statement>) {
    this.db = db;
  }

  /**
   * Initialize migrations table
   */
  async initializeMigrationsTable(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Get current database version
   */
  async getCurrentVersion(): Promise<number> {
    try {
      const result = await this.db.get(
        'SELECT MAX(version) as version FROM migrations'
      );
      return result?.version || 0;
    } catch (error) {
      // If migrations table doesn't exist, return 0
      return 0;
    }
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migration: Migration): Promise<DatabaseResult> {
    try {
      await this.db.exec('BEGIN TRANSACTION');
      
      // Execute migration
      await this.db.exec(migration.up);
      
      // Record migration
      await this.db.run(
        'INSERT INTO migrations (version, name) VALUES (?, ?)',
        [migration.version, migration.name]
      );
      
      await this.db.exec('COMMIT');
      
      console.log(`Applied migration ${migration.version}: ${migration.name}`);
      return { success: true };
    } catch (error) {
      await this.db.exec('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown migration error';
      console.error(`Failed to apply migration ${migration.version}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Rollback a single migration
   */
  async rollbackMigration(migration: Migration): Promise<DatabaseResult> {
    try {
      await this.db.exec('BEGIN TRANSACTION');
      
      // Execute rollback
      await this.db.exec(migration.down);
      
      // Remove migration record
      await this.db.run(
        'DELETE FROM migrations WHERE version = ?',
        [migration.version]
      );
      
      await this.db.exec('COMMIT');
      
      console.log(`Rolled back migration ${migration.version}: ${migration.name}`);
      return { success: true };
    } catch (error) {
      await this.db.exec('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown rollback error';
      console.error(`Failed to rollback migration ${migration.version}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(migrations: Migration[]): Promise<DatabaseResult> {
    try {
      await this.initializeMigrationsTable();
      const currentVersion = await this.getCurrentVersion();
      
      const pendingMigrations = migrations
        .filter(m => m.version > currentVersion)
        .sort((a, b) => a.version - b.version);

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations');
        return { success: true, data: { applied: 0 } };
      }

      console.log(`Running ${pendingMigrations.length} pending migrations...`);
      
      for (const migration of pendingMigrations) {
        const result = await this.applyMigration(migration);
        if (!result.success) {
          return result;
        }
      }

      console.log(`Successfully applied ${pendingMigrations.length} migrations`);
      return { success: true, data: { applied: pendingMigrations.length } };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown migration error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(): Promise<DatabaseResult> {
    try {
      const result = await this.db.all(
        'SELECT version, name, applied_at FROM migrations ORDER BY version'
      );
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
}

// Define all migrations
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- Buildings table
      CREATE TABLE IF NOT EXISTS buildings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Floor plans table
      CREATE TABLE IF NOT EXISTS floor_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        building_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        bedrooms INTEGER NOT NULL,
        bathrooms REAL NOT NULL,
        has_den BOOLEAN DEFAULT FALSE,
        square_footage INTEGER,
        building_position TEXT,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
        UNIQUE(building_id, name)
      );

      -- Price history table
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        floor_plan_id INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        is_available BOOLEAN DEFAULT TRUE,
        collection_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE CASCADE,
        UNIQUE(floor_plan_id, collection_date)
      );

      -- Alerts table
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        floor_plan_id INTEGER NOT NULL,
        alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'lowest_price')),
        old_price DECIMAL(10,2),
        new_price DECIMAL(10,2) NOT NULL,
        percentage_change REAL,
        is_dismissed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE CASCADE
      );

      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_floor_plans_building_id ON floor_plans(building_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_floor_plan_id ON price_history(floor_plan_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_collection_date ON price_history(collection_date);
      CREATE INDEX IF NOT EXISTS idx_alerts_floor_plan_id ON alerts(floor_plan_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_is_dismissed ON alerts(is_dismissed);
      CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

      -- Insert default data
      INSERT OR IGNORE INTO buildings (name, url) VALUES 
        ('Fairview', 'https://www.onnislu.com/fairview'),
        ('Boren', 'https://www.onnislu.com/boren');

      INSERT OR IGNORE INTO settings (key, value) VALUES 
        ('alert_threshold_type', 'percentage'),
        ('alert_threshold_value', '5'),
        ('last_collection_time', ''),
        ('next_collection_time', '');
    `,
    down: `
      DROP TABLE IF EXISTS alerts;
      DROP TABLE IF EXISTS price_history;
      DROP TABLE IF EXISTS floor_plans;
      DROP TABLE IF EXISTS buildings;
      DROP TABLE IF EXISTS settings;
    `
  }
];

/**
 * Run migrations using database connection
 */
export async function runMigrations(db: Database<sqlite3.Database, sqlite3.Statement>): Promise<DatabaseResult> {
  const migrationManager = new MigrationManager(db);
  return await migrationManager.runMigrations(migrations);
}