import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabaseConnection } from '../../database/connection';
import { DataService } from '../../services/DataService';

describe('Database Performance Tests', () => {
  let db: DatabaseConnection;
  let dataService: DataService;
  let buildingId: number;

  beforeAll(async () => {
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    dataService = new DataService(db);
    await dataService.init();

    const buildings = await dataService.getAllBuildings();
    buildingId = buildings.data[0].id;
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Large Dataset Operations', () => {
    it('should handle bulk floor plan inserts efficiently', async () => {
      const startTime = Date.now();
      const floorPlanCount = 100;

      // Insert 100 floor plans
      for (let i = 0; i < floorPlanCount; i++) {
        await db.executeUpdate(
          'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms, square_footage) VALUES (?, ?, ?, ?, ?)',
          [buildingId, `Plan ${i}`, i % 4, 1 + (i % 3) * 0.5, 500 + i * 10]
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 5 seconds for 100 inserts)
      expect(duration).toBeLessThan(5000);
      console.log(`Inserted ${floorPlanCount} floor plans in ${duration}ms`);
    });

    it('should handle bulk price history inserts efficiently', async () => {
      // Get a floor plan
      const floorPlans = await dataService.getAllFloorPlans();
      const floorPlanId = floorPlans.data[0].id;

      const startTime = Date.now();
      const priceRecordCount = 365; // One year of daily prices

      // Insert 365 price records
      for (let i = 0; i < priceRecordCount; i++) {
        const date = new Date('2024-01-01');
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const price = 2500 + Math.random() * 500 - 250; // Random price variation

        await dataService.addPriceHistory({
          floor_plan_id: floorPlanId,
          price: Math.round(price),
          is_available: Math.random() > 0.2, // 80% available
          collection_date: dateStr
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 10 seconds for 365 inserts)
      expect(duration).toBeLessThan(10000);
      console.log(`Inserted ${priceRecordCount} price records in ${duration}ms`);
    });

    it('should query large price history efficiently', async () => {
      const floorPlans = await dataService.getAllFloorPlans();
      const floorPlanId = floorPlans.data[0].id;

      const startTime = Date.now();
      const result = await dataService.getPriceHistory(floorPlanId);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      // Query should be fast (< 500ms)
      expect(duration).toBeLessThan(500);
      console.log(`Queried ${result.data.length} price records in ${duration}ms`);
    });

    it('should filter floor plans efficiently with complex criteria', async () => {
      const startTime = Date.now();
      
      const result = await dataService.getFloorPlansWithFilters({
        bedrooms: [1, 2],
        bathrooms: [1, 1.5],
        minSquareFootage: 600,
        maxSquareFootage: 1000
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      // Complex filter query should be fast (< 200ms)
      expect(duration).toBeLessThan(200);
      console.log(`Filtered ${result.data.length} floor plans in ${duration}ms`);
    });

    it('should handle concurrent read operations', async () => {
      const startTime = Date.now();
      const concurrentQueries = 50;

      // Execute 50 concurrent queries
      const promises = Array.from({ length: concurrentQueries }, () =>
        dataService.getAllFloorPlans()
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All queries should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should handle concurrent reads efficiently (< 2 seconds)
      expect(duration).toBeLessThan(2000);
      console.log(`Executed ${concurrentQueries} concurrent queries in ${duration}ms`);
    });

    it('should calculate statistics efficiently on large dataset', async () => {
      const startTime = Date.now();
      const result = await dataService.getStatistics();
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('buildings');
      expect(result.data).toHaveProperty('floor_plans');
      expect(result.data).toHaveProperty('price_records');

      // Statistics calculation should be fast (< 300ms)
      expect(duration).toBeLessThan(300);
      console.log(`Calculated statistics in ${duration}ms`);
      console.log(`Dataset size: ${result.data.floor_plans} floor plans, ${result.data.price_records} price records`);
    });
  });

  describe('Query Optimization', () => {
    it('should use indexes for common queries', async () => {
      // This test verifies that queries complete quickly, indicating proper indexing
      const floorPlans = await dataService.getAllFloorPlans();
      const floorPlanId = floorPlans.data[0].id;

      const startTime = Date.now();
      
      // Query by floor plan ID (should use index)
      await dataService.getFloorPlanById(floorPlanId);
      
      // Query price history by floor plan (should use index)
      await dataService.getPriceHistory(floorPlanId);
      
      // Query latest prices (should use index on collection_date)
      await dataService.getLatestPrices();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All indexed queries should complete very quickly (< 100ms total)
      expect(duration).toBeLessThan(100);
      console.log(`Executed 3 indexed queries in ${duration}ms`);
    });

    it('should handle date range queries efficiently', async () => {
      const floorPlans = await dataService.getAllFloorPlans();
      const floorPlanId = floorPlans.data[0].id;

      const startTime = Date.now();
      
      const result = await dataService.getPriceHistoryWithDateRange(
        floorPlanId,
        '2024-01-01',
        '2024-12-31'
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      // Date range query should be fast (< 200ms)
      expect(duration).toBeLessThan(200);
      console.log(`Date range query returned ${result.data.length} records in ${duration}ms`);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 100;

      // Perform repeated operations
      for (let i = 0; i < iterations; i++) {
        await dataService.getAllFloorPlans();
        await dataService.getLatestPrices();
        await dataService.getActiveAlerts();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Memory increase should be reasonable (< 50MB for 100 iterations)
      expect(memoryIncreaseMB).toBeLessThan(50);
      console.log(`Memory increase after ${iterations} iterations: ${memoryIncreaseMB.toFixed(2)}MB`);
    });
  });

  describe('Transaction Performance', () => {
    it('should handle complex transactions efficiently', async () => {
      const startTime = Date.now();

      const result = await db.executeTransaction(async (database) => {
        // Create building
        const buildingResult = await database.run(
          'INSERT INTO buildings (name, url) VALUES (?, ?)',
          ['Performance Test Building', 'https://perf-test.com']
        );

        // Create 10 floor plans
        const floorPlanIds = [];
        for (let i = 0; i < 10; i++) {
          const fpResult = await database.run(
            'INSERT INTO floor_plans (building_id, name, bedrooms, bathrooms) VALUES (?, ?, ?, ?)',
            [buildingResult.lastID, `Perf Plan ${i}`, i % 3, 1]
          );
          floorPlanIds.push(fpResult.lastID);
        }

        // Add price history for each
        for (const fpId of floorPlanIds) {
          await database.run(
            'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
            [fpId, 2500, true, '2024-01-15']
          );
        }

        return { buildingId: buildingResult.lastID, floorPlanCount: floorPlanIds.length };
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      // Complex transaction should complete quickly (< 1 second)
      expect(duration).toBeLessThan(1000);
      console.log(`Complex transaction (1 building + 10 floor plans + 10 prices) completed in ${duration}ms`);
    });
  });
});
