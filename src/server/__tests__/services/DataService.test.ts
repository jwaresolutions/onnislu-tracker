import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseConnection } from '../../database/connection';
import { DataService } from '../../services/DataService';

describe('DataService', () => {
  let db: DatabaseConnection;
  let dataService: DataService;

  beforeEach(async () => {
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    dataService = new DataService(db);
    await dataService.init();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Building Operations', () => {
    it('should get all buildings', async () => {
      const result = await dataService.getAllBuildings();
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should get building by ID', async () => {
      const allBuildings = await dataService.getAllBuildings();
      const firstBuilding = allBuildings.data[0];

      const result = await dataService.getBuildingById(firstBuilding.id);
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: firstBuilding.id,
        name: firstBuilding.name,
        url: firstBuilding.url
      });
    });

    it('should return error for non-existent building', async () => {
      const result = await dataService.getBuildingById(99999);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Floor Plan Operations', () => {
    let buildingId: number;

    beforeEach(async () => {
      const buildings = await dataService.getAllBuildings();
      buildingId = buildings.data[0].id;
    });

    it('should get all floor plans', async () => {
      const result = await dataService.getAllFloorPlans();
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get floor plan by ID', async () => {
      // Create a floor plan first
      const createResult = await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [buildingId, 'Test Plan', 1, 1]
      );

      const result = await dataService.getFloorPlanById(createResult.data.lastID);
      
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Plan');
      expect(result.data.bedrooms).toBe(1);
    });

    it('should get floor plans by building', async () => {
      // Create floor plans
      await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [buildingId, 'Plan 1', 1, 1]
      );
      await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [buildingId, 'Plan 2', 2, 1]
      );

      const result = await dataService.getFloorPlansByBuilding(buildingId);
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter floor plans by criteria', async () => {
      // Create test floor plans
      await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms, has_den) VALUES (?, ?, ?, ?, ?)',
        [buildingId, 'Studio', 0, 1, false]
      );
      await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms, has_den) VALUES (?, ?, ?, ?, ?)',
        [buildingId, '1BR with Den', 1, 1, true]
      );

      const result = await dataService.getFloorPlansWithFilters({
        bedrooms: [1],
        hasDen: true
      });
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data[0].bedrooms).toBe(1);
      expect(result.data[0].has_den).toBe(true);
    });
  });

  describe('Price History Operations', () => {
    let floorPlanId: number;

    beforeEach(async () => {
      const buildings = await dataService.getAllBuildings();
      const buildingId = buildings.data[0].id;

      const fpResult = await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [buildingId, 'Test Plan', 1, 1]
      );
      floorPlanId = fpResult.data.lastID;
    });

    it('should add price history', async () => {
      const result = await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2500,
        is_available: true,
        collection_date: '2024-01-15'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
    });

    it('should get price history for floor plan', async () => {
      // Add price history
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2500,
        is_available: true,
        collection_date: '2024-01-15'
      });
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2400,
        is_available: true,
        collection_date: '2024-01-16'
      });

      const result = await dataService.getPriceHistory(floorPlanId);
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
    });

    it('should get price history with date range', async () => {
      // Add price history
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2500,
        is_available: true,
        collection_date: '2024-01-10'
      });
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2400,
        is_available: true,
        collection_date: '2024-01-20'
      });
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2300,
        is_available: true,
        collection_date: '2024-01-30'
      });

      const result = await dataService.getPriceHistoryWithDateRange(
        floorPlanId,
        '2024-01-15',
        '2024-01-25'
      );
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.data[0].collection_date).toBe('2024-01-20');
    });

    it('should get latest prices for all floor plans', async () => {
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2500,
        is_available: true,
        collection_date: '2024-01-15'
      });

      const result = await dataService.getLatestPrices();
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get lowest price for floor plan', async () => {
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2500,
        is_available: true,
        collection_date: '2024-01-10'
      });
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2300,
        is_available: true,
        collection_date: '2024-01-15'
      });
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2400,
        is_available: true,
        collection_date: '2024-01-20'
      });

      const result = await dataService.getLowestPrice(floorPlanId);
      
      expect(result.success).toBe(true);
      expect(result.data.price).toBe(2300);
      expect(result.data.collection_date).toBe('2024-01-15');
    });
  });

  describe('Alert Operations', () => {
    let floorPlanId: number;

    beforeEach(async () => {
      const buildings = await dataService.getAllBuildings();
      const buildingId = buildings.data[0].id;

      const fpResult = await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [buildingId, 'Test Plan', 1, 1]
      );
      floorPlanId = fpResult.data.lastID;
    });

    it('should create alert', async () => {
      const result = await dataService.createAlert({
        floor_plan_id: floorPlanId,
        alert_type: 'price_drop',
        old_price: 2500,
        new_price: 2300,
        percentage_change: -8.0
      });
      
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
    });

    it('should get active alerts', async () => {
      await dataService.createAlert({
        floor_plan_id: floorPlanId,
        alert_type: 'price_drop',
        new_price: 2300
      });

      const result = await dataService.getActiveAlerts();
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data[0].is_dismissed).toBe(false);
    });

    it('should dismiss alert', async () => {
      const createResult = await dataService.createAlert({
        floor_plan_id: floorPlanId,
        alert_type: 'lowest_price',
        new_price: 2200
      });

      const dismissResult = await dataService.dismissAlert(createResult.data.id);
      
      expect(dismissResult.success).toBe(true);

      // Verify alert is dismissed
      const alertResult = await db.executeQuerySingle(
        'SELECT is_dismissed FROM alerts WHERE id = ?',
        [createResult.data.id]
      );
      expect(alertResult.data.is_dismissed).toBe(true);
    });
  });

  describe('Settings Operations', () => {
    it('should get setting by key', async () => {
      const result = await dataService.getSetting('alert_threshold_type');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should update setting', async () => {
      const result = await dataService.updateSetting('alert_threshold_type', 'dollar');
      
      expect(result.success).toBe(true);

      // Verify update
      const getResult = await dataService.getSetting('alert_threshold_type');
      expect(getResult.data.value).toBe('dollar');
    });

    it('should get all settings', async () => {
      const result = await dataService.getAllSettings();
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should get database statistics', async () => {
      const result = await dataService.getStatistics();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('buildings');
      expect(result.data).toHaveProperty('floor_plans');
      expect(result.data).toHaveProperty('price_records');
      expect(result.data).toHaveProperty('active_alerts');
    });
  });
});
