import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseConnection } from '../../database/connection';
import { DataService } from '../../services/DataService';
import { AlertService } from '../../services/AlertService';

describe('AlertService', () => {
  let db: DatabaseConnection;
  let dataService: DataService;
  let alertService: AlertService;
  let buildingId: number;
  let floorPlanId: number;

  beforeEach(async () => {
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    dataService = new DataService(db);
    await dataService.init();
    alertService = new AlertService(dataService);
    await alertService.init();

    // Create test building and floor plan
    const buildings = await dataService.getAllBuildings();
    buildingId = buildings.data[0].id;

    const fpResult = await db.executeUpdate(
      'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
      [buildingId, 'Test Plan', 1, 1]
    );
    floorPlanId = fpResult.data.lastID;
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Alert Detection', () => {
    it('should detect price drop alert', async () => {
      // Set threshold
      await dataService.updateSetting('alert_threshold_type', 'percentage');
      await dataService.updateSetting('alert_threshold_value', '5');

      // Add initial price
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2500,
        is_available: true,
        collection_date: '2024-01-10'
      });

      // Add new lower price (10% drop)
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2250,
        is_available: true,
        collection_date: '2024-01-15'
      });

      const result = await alertService.checkPriceDrops(floorPlanId);
      
      expect(result.success).toBe(true);
      expect(result.data.alertCreated).toBe(true);
    });

    it('should not create alert for small price drop', async () => {
      // Set threshold
      await dataService.updateSetting('alert_threshold_type', 'percentage');
      await dataService.updateSetting('alert_threshold_value', '10');

      // Add initial price
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2500,
        is_available: true,
        collection_date: '2024-01-10'
      });

      // Add new price with small drop (4%)
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2400,
        is_available: true,
        collection_date: '2024-01-15'
      });

      const result = await alertService.checkPriceDrops(floorPlanId);
      
      expect(result.success).toBe(true);
      expect(result.data.alertCreated).toBe(false);
    });

    it('should detect lowest price alert', async () => {
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
        collection_date: '2024-01-15'
      });

      // Add new lowest price
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2300,
        is_available: true,
        collection_date: '2024-01-20'
      });

      const result = await alertService.checkLowestPrice(floorPlanId);
      
      expect(result.success).toBe(true);
      expect(result.data.isLowest).toBe(true);
    });

    it('should handle dollar threshold type', async () => {
      // Set dollar threshold
      await dataService.updateSetting('alert_threshold_type', 'dollar');
      await dataService.updateSetting('alert_threshold_value', '100');

      // Add initial price
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2500,
        is_available: true,
        collection_date: '2024-01-10'
      });

      // Add new price with $150 drop
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2350,
        is_available: true,
        collection_date: '2024-01-15'
      });

      const result = await alertService.checkPriceDrops(floorPlanId);
      
      expect(result.success).toBe(true);
      expect(result.data.alertCreated).toBe(true);
    });
  });

  describe('Alert Settings', () => {
    it('should get alert settings', async () => {
      const result = await alertService.getAlertSettings();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('thresholdType');
      expect(result.data).toHaveProperty('thresholdValue');
    });

    it('should update alert settings', async () => {
      const result = await alertService.updateAlertSettings({
        thresholdType: 'dollar',
        thresholdValue: 50
      });
      
      expect(result.success).toBe(true);

      // Verify update
      const getResult = await alertService.getAlertSettings();
      expect(getResult.data.thresholdType).toBe('dollar');
      expect(getResult.data.thresholdValue).toBe(50);
    });

    it('should validate alert settings', async () => {
      const result = await alertService.updateAlertSettings({
        thresholdType: 'percentage',
        thresholdValue: -5 // Invalid negative value
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('must be positive');
    });
  });

  describe('Alert Management', () => {
    it('should get all active alerts', async () => {
      // Create alerts
      await dataService.createAlert({
        floor_plan_id: floorPlanId,
        alert_type: 'price_drop',
        new_price: 2300
      });

      const result = await alertService.getActiveAlerts();
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should dismiss alert', async () => {
      // Create alert
      const createResult = await dataService.createAlert({
        floor_plan_id: floorPlanId,
        alert_type: 'lowest_price',
        new_price: 2200
      });

      const dismissResult = await alertService.dismissAlert(createResult.data.id);
      
      expect(dismissResult.success).toBe(true);

      // Verify alert is no longer active
      const activeAlerts = await alertService.getActiveAlerts();
      const dismissedAlert = activeAlerts.data.find((a: any) => a.id === createResult.data.id);
      expect(dismissedAlert).toBeUndefined();
    });
  });

  describe('Batch Alert Processing', () => {
    it('should process alerts for all floor plans', async () => {
      // Create multiple floor plans with price history
      const fp2Result = await db.executeUpdate(
        'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
        [buildingId, 'Test Plan 2', 2, 1]
      );

      // Add price history for both
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2500,
        is_available: true,
        collection_date: '2024-01-10'
      });
      await dataService.addPriceHistory({
        floor_plan_id: fp2Result.data.lastID,
        price: 3000,
        is_available: true,
        collection_date: '2024-01-10'
      });

      // Set threshold
      await dataService.updateSetting('alert_threshold_type', 'percentage');
      await dataService.updateSetting('alert_threshold_value', '5');

      // Add new prices with drops
      await dataService.addPriceHistory({
        floor_plan_id: floorPlanId,
        price: 2300,
        is_available: true,
        collection_date: '2024-01-15'
      });
      await dataService.addPriceHistory({
        floor_plan_id: fp2Result.data.lastID,
        price: 2800,
        is_available: true,
        collection_date: '2024-01-15'
      });

      const result = await alertService.processAllAlerts();
      
      expect(result.success).toBe(true);
      expect(result.data.alertsCreated).toBeGreaterThanOrEqual(2);
    });
  });
});
