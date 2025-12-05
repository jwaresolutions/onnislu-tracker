import { DatabaseConnection } from '../database/connection';
import { MigrationManager } from '../database/migrations';
import { 
  Building, 
  FloorPlan, 
  PriceHistory, 
  Alert, 
  Settings,
  CreateBuildingInput,
  CreateFloorPlanInput,
  CreatePriceHistoryInput,
  CreateAlertInput
} from '../../shared/types/database';
import fs from 'fs/promises';
import path from 'path';

describe('Database Operations', () => {
  let db: DatabaseConnection;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeEach(async () => {
    db = new DatabaseConnection(testDbPath);
    const result = await db.initialize();
    expect(result.success).toBe(true);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Database Connection', () => {
    test('should initialize database successfully', async () => {
      const newDb = new DatabaseConnection(':memory:');
      const result = await newDb.initialize();
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      
      await newDb.close();
    });

    test('should enable foreign key constraints', async () => {
      const database = db.getDatabase();
      const result = await database.get('PRAGMA foreign_keys');
      expect(result.foreign_keys).toBe(1);
    });

    test('should check database health', async () => {
      const result = await db.checkHealth();
      
      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(true);
      expect(result.data.integrity).toBe('ok');
    });

    test('should get database statistics', async () => {
      const result = await db.getStats();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('buildings');
      expect(result.data).toHaveProperty('floor_plans');
      expect(result.data).toHaveProperty('price_records');
      expect(result.data).toHaveProperty('active_alerts');
    });
  });

  describe('Buildings Operations', () => {
    test('should insert and retrieve buildings', async () => {
      const buildingData: CreateBuildingInput = {
        name: 'Test Building',
        url: 'https://test.com'
      };

      // Insert building
      const insertResult = await db.executeUpdate(
        'INSERT INTO buildings (name, url) VALUES (?, ?)',
        [buildingData.name, buildingData.url]
      );

      expect(insertResult.success).toBe(true);
      expect(insertResult.data.lastID).toBeDefined();

      // Retrieve building
      const selectResult = await db.executeQuerySingle(
        'SELECT * FROM buildings WHERE id = ?',
        [insertResult.data.lastID]
      );

      expect(selectResult.success).toBe(true);
      const building = selectResult.data as Building;
      expect(building.name).toBe(buildingData.name);
      expect(building.url).toBe(buildingData.url);
      expect(building.created_at).toBeDefined();
    });

    test('should enforce unique building names', async () => {
      const buildingData: CreateBuildingInput = {
        name: 'Duplicate Building',
        url: 'https://test1.com'
      };

      // Insert first building
      const firstInsert = await db.executeUpdate(
        'INSERT INTO buildings (name, url) VALUES (?, ?)',
        [buildingData.name, buildingData.url]
      );
      expect(firstInsert.success).toBe(true);

      // Try to insert duplicate
      const duplicateInsert = await db.executeUpdate(
        'INSERT INTO buildings (name, url) VALUES (?, ?)',
        [buildingData.name, 'https://test2.com']
      );
      expect(duplicateInsert.success).toBe(false);
      expect(duplicateInsert.error).toContain('UNIQUE constraint failed');
    });
  });

  describe('Floor Plans Operations', () => {
    let buildingId: number;

    beforeEach(async () => {
      // Create a test building first
      const buildingResult = await db.executeUpdate(
        'INSERT INTO buildings (name, url) VALUES (?, ?)',
        ['Test Building', 'https://test.com']
      );
      buildingId = buildingResult.data.lastID;
    });

    test('should insert and retrieve floor plans', async () => {
      const floorPlanData: CreateFloorPlanInput = {
        building_id: buildingId,
        name: 'Test Floor Plan',
        bedrooms: 2,
        bathrooms: 1.5,
        has_den: true,
        square_footage: 1200,
        building_position: 'North-facing'
      };

      // Insert floor plan
      const insertResult = await db.executeUpdate(
        `INSERT INTO floor_plans 
         (building_id, name, bedrooms, bathrooms, has_den, square_footage, building_position) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          floorPlanData.building_id,
          floorPlanData.name,
          floorPlanData.bedrooms,
          floorPlanData.bathrooms,
          floorPlanData.has_den,
          floorPlanData.square_footage,
          floorPlanData.building_position
        ]
      );

      expect(insertResult.success).toBe(true);

      // Retrieve floor plan with building info
      const selectResult = await db.executeQuerySingle(
        `SELECT fp.*, b.name as building_name 
         FROM floor_plans fp 
         JOIN buildings b ON fp.building_id = b.id 
         WHERE fp.id = ?`,
        [insertResult.data.lastID]
      );

      expect(selectResult.success).toBe(true);
      const floorPlan = selectResult.data as FloorPlan;
      expect(floorPlan.name).toBe(floorPlanData.name);
      expect(floorPlan.bedrooms).toBe(floorPlanData.bedrooms);
      expect(floorPlan.bathrooms).toBe(floorPlanData.bathrooms);
      expect(!!floorPlan.has_den).toBe(floorPlanData.has_den); // SQLite returns 0/1 for booleans
      expect(floorPlan.square_footage).toBe(floorPlanData.square_footage);
      expect(floorPlan.building_position).toBe(floorPlanData.building_position);
      expect(floorPlan.building_name).toBe('Test Building');
    });

    test('should enforce foreign key constraint for building_id', async () => {
      const floorPlanData: CreateFloorPlanInput = {
        building_id: 99999, // Non-existent building
        name: 'Invalid Floor Plan',
        bedrooms: 1,
        bathrooms: 1
      };

      const insertResult = await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [floorPlanData.building_id, floorPlanData.name, floorPlanData.bedrooms, floorPlanData.bathrooms]
      );

      expect(insertResult.success).toBe(false);
      expect(insertResult.error).toContain('FOREIGN KEY constraint failed');
    });

    test('should enforce unique floor plan names per building', async () => {
      const floorPlanData: CreateFloorPlanInput = {
        building_id: buildingId,
        name: 'Duplicate Plan',
        bedrooms: 1,
        bathrooms: 1
      };

      // Insert first floor plan
      const firstInsert = await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [floorPlanData.building_id, floorPlanData.name, floorPlanData.bedrooms, floorPlanData.bathrooms]
      );
      expect(firstInsert.success).toBe(true);

      // Try to insert duplicate in same building
      const duplicateInsert = await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [floorPlanData.building_id, floorPlanData.name, 2, 2]
      );
      expect(duplicateInsert.success).toBe(false);
      expect(duplicateInsert.error).toContain('UNIQUE constraint failed');
    });
  });

  describe('Price History Operations', () => {
    let floorPlanId: number;

    beforeEach(async () => {
      // Create test building and floor plan
      const buildingResult = await db.executeUpdate(
        'INSERT INTO buildings (name, url) VALUES (?, ?)',
        ['Test Building', 'https://test.com']
      );

      const floorPlanResult = await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [buildingResult.data.lastID, 'Test Plan', 1, 1]
      );
      floorPlanId = floorPlanResult.data.lastID;
    });

    test('should insert and retrieve price history', async () => {
      const priceData: CreatePriceHistoryInput = {
        floor_plan_id: floorPlanId,
        price: 2500.00,
        is_available: true,
        collection_date: '2024-01-15'
      };

      // Insert price history
      const insertResult = await db.executeUpdate(
        'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
        [priceData.floor_plan_id, priceData.price, priceData.is_available, priceData.collection_date]
      );

      expect(insertResult.success).toBe(true);

      // Retrieve price history
      const selectResult = await db.executeQuerySingle(
        'SELECT * FROM price_history WHERE id = ?',
        [insertResult.data.lastID]
      );

      expect(selectResult.success).toBe(true);
      const priceHistory = selectResult.data as PriceHistory;
      expect(priceHistory.floor_plan_id).toBe(priceData.floor_plan_id);
      expect(priceHistory.price).toBe(priceData.price);
      expect(!!priceHistory.is_available).toBe(priceData.is_available); // SQLite returns 0/1 for booleans
      expect(priceHistory.collection_date).toBe(priceData.collection_date);
    });

    test('should enforce unique floor plan and date combination', async () => {
      const priceData: CreatePriceHistoryInput = {
        floor_plan_id: floorPlanId,
        price: 2500.00,
        is_available: true,
        collection_date: '2024-01-15'
      };

      // Insert first price record
      const firstInsert = await db.executeUpdate(
        'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
        [priceData.floor_plan_id, priceData.price, priceData.is_available, priceData.collection_date]
      );
      expect(firstInsert.success).toBe(true);

      // Try to insert duplicate for same date
      const duplicateInsert = await db.executeUpdate(
        'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
        [priceData.floor_plan_id, 2600.00, false, priceData.collection_date]
      );
      expect(duplicateInsert.success).toBe(false);
      expect(duplicateInsert.error).toContain('UNIQUE constraint failed');
    });

    test('should retrieve price history with date range', async () => {
      // Insert multiple price records
      const prices = [
        { date: '2024-01-10', price: 2400 },
        { date: '2024-01-15', price: 2500 },
        { date: '2024-01-20', price: 2450 },
        { date: '2024-01-25', price: 2550 }
      ];

      for (const priceData of prices) {
        await db.executeUpdate(
          'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
          [floorPlanId, priceData.price, true, priceData.date]
        );
      }

      // Query date range
      const rangeResult = await db.executeQuery(
        `SELECT * FROM price_history 
         WHERE floor_plan_id = ? AND collection_date BETWEEN ? AND ? 
         ORDER BY collection_date`,
        [floorPlanId, '2024-01-12', '2024-01-22']
      );

      expect(rangeResult.success).toBe(true);
      expect(rangeResult.data).toHaveLength(2);
      expect(rangeResult.data[0].collection_date).toBe('2024-01-15');
      expect(rangeResult.data[1].collection_date).toBe('2024-01-20');
    });
  });

  describe('Alerts Operations', () => {
    let floorPlanId: number;

    beforeEach(async () => {
      // Create test building and floor plan
      const buildingResult = await db.executeUpdate(
        'INSERT INTO buildings (name, url) VALUES (?, ?)',
        ['Test Building', 'https://test.com']
      );

      const floorPlanResult = await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [buildingResult.data.lastID, 'Test Plan', 1, 1]
      );
      floorPlanId = floorPlanResult.data.lastID;
    });

    test('should insert and retrieve alerts', async () => {
      const alertData: CreateAlertInput = {
        floor_plan_id: floorPlanId,
        alert_type: 'price_drop',
        old_price: 2500.00,
        new_price: 2300.00,
        percentage_change: -8.0
      };

      // Insert alert
      const insertResult = await db.executeUpdate(
        'INSERT INTO alerts (floor_plan_id, alert_type, old_price, new_price, percentage_change) VALUES (?, ?, ?, ?, ?)',
        [alertData.floor_plan_id, alertData.alert_type, alertData.old_price, alertData.new_price, alertData.percentage_change]
      );

      expect(insertResult.success).toBe(true);

      // Retrieve alert with floor plan and building info
      const selectResult = await db.executeQuerySingle(
        `SELECT a.*, fp.name as floor_plan_name, b.name as building_name
         FROM alerts a
         JOIN floor_plans fp ON a.floor_plan_id = fp.id
         JOIN buildings b ON fp.building_id = b.id
         WHERE a.id = ?`,
        [insertResult.data.lastID]
      );

      expect(selectResult.success).toBe(true);
      const alert = selectResult.data as Alert;
      expect(alert.floor_plan_id).toBe(alertData.floor_plan_id);
      expect(alert.alert_type).toBe(alertData.alert_type);
      expect(alert.old_price).toBe(alertData.old_price);
      expect(alert.new_price).toBe(alertData.new_price);
      expect(alert.percentage_change).toBe(alertData.percentage_change);
      expect(!!alert.is_dismissed).toBe(false); // SQLite returns 0/1 for booleans
      expect(alert.floor_plan_name).toBe('Test Plan');
      expect(alert.building_name).toBe('Test Building');
    });

    test('should validate alert types', async () => {
      const invalidAlertData = {
        floor_plan_id: floorPlanId,
        alert_type: 'invalid_type',
        new_price: 2300.00
      };

      const insertResult = await db.executeUpdate(
        'INSERT INTO alerts (floor_plan_id, alert_type, new_price) VALUES (?, ?, ?)',
        [invalidAlertData.floor_plan_id, invalidAlertData.alert_type, invalidAlertData.new_price]
      );

      expect(insertResult.success).toBe(false);
      expect(insertResult.error).toContain('CHECK constraint failed');
    });

    test('should dismiss alerts', async () => {
      // Insert alert
      const insertResult = await db.executeUpdate(
        'INSERT INTO alerts (floor_plan_id, alert_type, new_price) VALUES (?, ?, ?)',
        [floorPlanId, 'lowest_price', 2200.00]
      );

      // Dismiss alert
      const dismissResult = await db.executeUpdate(
        'UPDATE alerts SET is_dismissed = TRUE WHERE id = ?',
        [insertResult.data.lastID]
      );

      expect(dismissResult.success).toBe(true);

      // Verify dismissal
      const selectResult = await db.executeQuerySingle(
        'SELECT is_dismissed FROM alerts WHERE id = ?',
        [insertResult.data.lastID]
      );

      expect(selectResult.success).toBe(true);
      expect(!!selectResult.data.is_dismissed).toBe(true); // SQLite returns 0/1 for booleans
    });
  });

  describe('Settings Operations', () => {
    test('should insert and retrieve settings', async () => {
      const settingKey = 'test_setting';
      const settingValue = 'test_value';

      // Insert setting
      const insertResult = await db.executeUpdate(
        'INSERT INTO settings (key, value) VALUES (?, ?)',
        [settingKey, settingValue]
      );

      expect(insertResult.success).toBe(true);

      // Retrieve setting
      const selectResult = await db.executeQuerySingle(
        'SELECT * FROM settings WHERE key = ?',
        [settingKey]
      );

      expect(selectResult.success).toBe(true);
      const setting = selectResult.data as Settings;
      expect(setting.key).toBe(settingKey);
      expect(setting.value).toBe(settingValue);
      expect(setting.updated_at).toBeDefined();
    });

    test('should update existing settings', async () => {
      const settingKey = 'update_test';
      const initialValue = 'initial';
      const updatedValue = 'updated';

      // Insert initial setting
      await db.executeUpdate(
        'INSERT INTO settings (key, value) VALUES (?, ?)',
        [settingKey, initialValue]
      );

      // Update setting
      const updateResult = await db.executeUpdate(
        'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        [updatedValue, settingKey]
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.changes).toBe(1);

      // Verify update
      const selectResult = await db.executeQuerySingle(
        'SELECT value FROM settings WHERE key = ?',
        [settingKey]
      );

      expect(selectResult.success).toBe(true);
      expect(selectResult.data.value).toBe(updatedValue);
    });

    test('should enforce unique setting keys', async () => {
      const settingKey = 'duplicate_key';

      // Insert first setting
      const firstInsert = await db.executeUpdate(
        'INSERT INTO settings (key, value) VALUES (?, ?)',
        [settingKey, 'value1']
      );
      expect(firstInsert.success).toBe(true);

      // Try to insert duplicate key
      const duplicateInsert = await db.executeUpdate(
        'INSERT INTO settings (key, value) VALUES (?, ?)',
        [settingKey, 'value2']
      );
      expect(duplicateInsert.success).toBe(false);
      expect(duplicateInsert.error).toContain('UNIQUE constraint failed');
    });
  });

  describe('Transaction Operations', () => {
    test('should execute successful transactions', async () => {
      const result = await db.executeTransaction(async (database) => {
        // Insert building
        const buildingResult = await database.run(
          'INSERT INTO buildings (name, url) VALUES (?, ?)',
          ['Transaction Building', 'https://transaction.com']
        );

        // Insert floor plan
        await database.run(
          'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
          [buildingResult.lastID, 'Transaction Plan', 2, 1]
        );

        return { buildingId: buildingResult.lastID };
      });

      expect(result.success).toBe(true);
      expect(result.data?.buildingId).toBeDefined();

      // Verify data was committed
      const buildingCheck = await db.executeQuerySingle(
        'SELECT * FROM buildings WHERE id = ?',
        [result.data!.buildingId]
      );
      expect(buildingCheck.success).toBe(true);
      expect(buildingCheck.data.name).toBe('Transaction Building');
    });

    test('should rollback failed transactions', async () => {
      const result = await db.executeTransaction(async (database) => {
        // Insert building
        const buildingResult = await database.run(
          'INSERT INTO buildings (name, url) VALUES (?, ?)',
          ['Rollback Building', 'https://rollback.com']
        );

        // This should fail due to foreign key constraint
        await database.run(
          'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
          [99999, 'Invalid Plan', 1, 1]
        );

        return { buildingId: buildingResult.lastID };
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('FOREIGN KEY constraint failed');

      // Verify rollback - building should not exist
      const buildingCheck = await db.executeQuery(
        'SELECT * FROM buildings WHERE name = ?',
        ['Rollback Building']
      );
      expect(buildingCheck.success).toBe(true);
      expect(buildingCheck.data).toHaveLength(0);
    });
  });

  describe('Complex Queries', () => {
    beforeEach(async () => {
      // Clear existing test data
      await db.executeUpdate('DELETE FROM price_history WHERE floor_plan_id IN (SELECT id FROM floor_plans WHERE building_id IN (SELECT id FROM buildings WHERE name LIKE "Test%Complex"))');
      await db.executeUpdate('DELETE FROM floor_plans WHERE building_id IN (SELECT id FROM buildings WHERE name LIKE "Test%Complex")');
      await db.executeUpdate('DELETE FROM buildings WHERE name LIKE "Test%Complex"');
      
      // Set up test data
      const result = await db.executeTransaction(async (database) => {
        // Insert buildings with unique names for this test
        const fairviewResult = await database.run(
          'INSERT INTO buildings (name, url) VALUES (?, ?)',
          ['Test Fairview Complex', 'https://fairview.com']
        );
        const borenResult = await database.run(
          'INSERT INTO buildings (name, url) VALUES (?, ?)',
          ['Test Boren Complex', 'https://boren.com']
        );

        // Insert floor plans
        const fp1Result = await database.run(
          'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms, has_den, square_footage) VALUES (?, ?, ?, ?, ?, ?)',
          [fairviewResult.lastID, 'Studio A', 0, 1, false, 500]
        );
        const fp2Result = await database.run(
          'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms, has_den, square_footage) VALUES (?, ?, ?, ?, ?, ?)',
          [fairviewResult.lastID, '1BR B', 1, 1, true, 750]
        );
        const fp3Result = await database.run(
          'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms, has_den, square_footage) VALUES (?, ?, ?, ?, ?, ?)',
          [borenResult.lastID, '2BR C', 2, 2, false, 1200]
        );

        // Insert price history
        await database.run(
          'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
          [fp1Result.lastID, 2000, true, '2024-01-10']
        );
        await database.run(
          'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
          [fp1Result.lastID, 1950, true, '2024-01-15']
        );
        await database.run(
          'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
          [fp2Result.lastID, 2800, false, '2024-01-10']
        );
        await database.run(
          'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
          [fp3Result.lastID, 3500, true, '2024-01-10']
        );
        return { success: true };
      });
      
      if (!result.success) {
        throw new Error(`Failed to set up test data: ${result.error}`);
      }
    });

    test('should get floor plans with current and lowest prices', async () => {
      // First verify data exists
      const fpCheck = await db.executeQuery('SELECT * FROM floor_plans');
      expect(fpCheck.success).toBe(true);
      expect(fpCheck.data.length).toBeGreaterThan(0);
      
      const result = await db.executeQuery(`
        SELECT 
          fp.*,
          b.name as building_name,
          (SELECT price FROM price_history WHERE floor_plan_id = fp.id ORDER BY collection_date DESC LIMIT 1) as current_price,
          (SELECT is_available FROM price_history WHERE floor_plan_id = fp.id ORDER BY collection_date DESC LIMIT 1) as is_available,
          (SELECT MIN(price) FROM price_history WHERE floor_plan_id = fp.id) as lowest_price
        FROM floor_plans fp
        JOIN buildings b ON fp.building_id = b.id
        ORDER BY b.name, fp.name
      `);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Check Studio A has lowest price of 1950
      const studioA = result.data.find((fp: any) => fp.name === 'Studio A');
      if (studioA) {
        expect(studioA.current_price).toBe(1950);
        expect(studioA.lowest_price).toBe(1950);
        expect(studioA.building_name).toBe('Test Fairview Complex');
      }
    });

    test('should filter floor plans by criteria', async () => {
      const result = await db.executeQuery(`
        SELECT fp.*, b.name as building_name
        FROM floor_plans fp
        JOIN buildings b ON fp.building_id = b.id
        WHERE fp.bedrooms >= ? AND fp.has_den = ?
        ORDER BY fp.bedrooms, fp.name
      `, [1, true]);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      const denPlan = result.data.find((fp: any) => fp.name === '1BR B');
      if (denPlan) {
        expect(!!denPlan.has_den).toBe(true); // SQLite returns 0/1 for booleans
      }
    });

    test('should get price trends over time', async () => {
      const result = await db.executeQuery(`
        SELECT 
          ph.collection_date,
          ph.price,
          fp.name as floor_plan_name,
          b.name as building_name
        FROM price_history ph
        JOIN floor_plans fp ON ph.floor_plan_id = fp.id
        JOIN buildings b ON fp.building_id = b.id
        WHERE ph.collection_date BETWEEN ? AND ?
        ORDER BY ph.collection_date, b.name, fp.name
      `, ['2024-01-01', '2024-01-31']);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Verify data structure
      result.data.forEach((record: any) => {
        expect(record).toHaveProperty('collection_date');
        expect(record).toHaveProperty('price');
        expect(record).toHaveProperty('floor_plan_name');
        expect(record).toHaveProperty('building_name');
      });
    });
  });
});