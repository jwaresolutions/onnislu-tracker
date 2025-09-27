import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseConnection } from '../database/connection';
import { MigrationManager, migrations } from '../database/migrations';
import path from 'path';
import fs from 'fs/promises';

describe('Database Integration Tests', () => {
  let db: DatabaseConnection;
  const testDbPath = path.join(__dirname, 'integration-test.db');

  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File might not exist, that's fine
    }
  });

  it('should initialize database with schema and default data', async () => {
    db = new DatabaseConnection(testDbPath);
    const result = await db.initialize();
    
    expect(result.success).toBe(true);

    // Verify tables exist
    const database = db.getDatabase();
    const tables = await database.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    
    const tableNames = tables.map((table: any) => table.name);
    expect(tableNames).toContain('buildings');
    expect(tableNames).toContain('floor_plans');
    expect(tableNames).toContain('price_history');
    expect(tableNames).toContain('alerts');
    expect(tableNames).toContain('settings');

    // Verify default data exists
    const buildingsResult = await db.executeQuery('SELECT * FROM buildings');
    expect(buildingsResult.success).toBe(true);
    expect(buildingsResult.data.length).toBeGreaterThanOrEqual(2);

    const settingsResult = await db.executeQuery('SELECT * FROM settings');
    expect(settingsResult.success).toBe(true);
    expect(settingsResult.data.length).toBeGreaterThan(0);
  });

  it('should handle migrations correctly', async () => {
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    
    const database = db.getDatabase();
    const migrationManager = new MigrationManager(database);
    
    // Run migrations
    const migrationResult = await migrationManager.runMigrations(migrations);
    expect(migrationResult.success).toBe(true);

    // Check migration history
    const historyResult = await migrationManager.getMigrationHistory();
    expect(historyResult.success).toBe(true);
    expect(historyResult.data.length).toBeGreaterThan(0);

    // Verify current version
    const currentVersion = await migrationManager.getCurrentVersion();
    expect(currentVersion).toBeGreaterThan(0);
  });

  it('should perform complete CRUD operations', async () => {
    db = new DatabaseConnection(testDbPath);
    await db.initialize();

    // Test complete workflow: Building -> Floor Plan -> Price History -> Alert
    const result = await db.executeTransaction(async (database) => {
      // Create building
      const buildingResult = await database.run(
        'INSERT INTO buildings (name, url) VALUES (?, ?)',
        ['Integration Test Building', 'https://integration-test.com']
      );
      const buildingId = buildingResult.lastID;

      // Create floor plan
      const floorPlanResult = await database.run(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms, has_den, square_footage) VALUES (?, ?, ?, ?, ?, ?)',
        [buildingId, 'Integration Test Plan', 2, 1.5, true, 1000]
      );
      const floorPlanId = floorPlanResult.lastID;

      // Add price history
      await database.run(
        'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
        [floorPlanId, 2500.00, true, '2024-01-15']
      );

      // Create alert
      await database.run(
        'INSERT INTO alerts (floor_plan_id, alert_type, new_price) VALUES (?, ?, ?)',
        [floorPlanId, 'lowest_price', 2500.00]
      );

      return { buildingId, floorPlanId };
    });

    expect(result.success).toBe(true);
    expect(result.data.buildingId).toBeDefined();
    expect(result.data.floorPlanId).toBeDefined();

    // Verify data with complex query
    const queryResult = await db.executeQuery(`
      SELECT 
        b.name as building_name,
        fp.name as floor_plan_name,
        fp.bedrooms,
        fp.bathrooms,
        fp.has_den,
        fp.square_footage,
        ph.price,
        ph.collection_date,
        a.alert_type
      FROM buildings b
      JOIN floor_plans fp ON b.id = fp.building_id
      JOIN price_history ph ON fp.id = ph.floor_plan_id
      JOIN alerts a ON fp.id = a.floor_plan_id
      WHERE b.id = ?
    `, [result.data.buildingId]);

    expect(queryResult.success).toBe(true);
    expect(queryResult.data.length).toBe(1);
    
    const record = queryResult.data[0];
    expect(record.building_name).toBe('Integration Test Building');
    expect(record.floor_plan_name).toBe('Integration Test Plan');
    expect(record.bedrooms).toBe(2);
    expect(record.bathrooms).toBe(1.5);
    expect(record.has_den).toBe(true);
    expect(record.square_footage).toBe(1000);
    expect(record.price).toBe(2500.00);
    expect(record.alert_type).toBe('lowest_price');
  });

  it('should handle database health checks and statistics', async () => {
    db = new DatabaseConnection(testDbPath);
    await db.initialize();

    // Health check
    const healthResult = await db.checkHealth();
    expect(healthResult.success).toBe(true);
    expect(healthResult.data.connected).toBe(true);
    expect(healthResult.data.integrity).toBe('ok');

    // Statistics
    const statsResult = await db.getStats();
    expect(statsResult.success).toBe(true);
    expect(statsResult.data).toHaveProperty('buildings');
    expect(statsResult.data).toHaveProperty('floor_plans');
    expect(statsResult.data).toHaveProperty('price_records');
    expect(statsResult.data).toHaveProperty('active_alerts');
    expect(statsResult.data.buildings).toBeGreaterThanOrEqual(2); // Default buildings
  });

  it('should enforce database constraints', async () => {
    db = new DatabaseConnection(testDbPath);
    await db.initialize();

    // Test foreign key constraint
    const foreignKeyResult = await db.executeUpdate(
      'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
      [99999, 'Invalid Plan', 1, 1]
    );
    expect(foreignKeyResult.success).toBe(false);
    expect(foreignKeyResult.error).toContain('FOREIGN KEY constraint failed');

    // Test unique constraint
    const uniqueResult = await db.executeUpdate(
      'INSERT INTO buildings (name, url) VALUES (?, ?)',
      ['Fairview', 'https://duplicate.com'] // Fairview already exists from default data
    );
    expect(uniqueResult.success).toBe(false);
    expect(uniqueResult.error).toContain('UNIQUE constraint failed');

    // Test check constraint
    const checkResult = await db.executeUpdate(
      'INSERT INTO alerts (floor_plan_id, alert_type, new_price) VALUES (?, ?, ?)',
      [1, 'invalid_type', 2000.00]
    );
    expect(checkResult.success).toBe(false);
    expect(checkResult.error).toContain('CHECK constraint failed');
  });
});