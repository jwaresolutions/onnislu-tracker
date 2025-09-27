import { DatabaseConnection } from './connection';
import { 
  Building, 
  FloorPlan, 
  PriceHistory, 
  Alert,
  CreateBuildingInput,
  CreateFloorPlanInput,
  CreatePriceHistoryInput,
  CreateAlertInput,
  DatabaseResult
} from '../../shared/types/database';

/**
 * Database utility functions for common operations
 */
export class DatabaseUtils {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Create a new building
   */
  async createBuilding(data: CreateBuildingInput): Promise<DatabaseResult> {
    return await this.db.executeUpdate(
      'INSERT INTO buildings (name, url) VALUES (?, ?)',
      [data.name, data.url]
    );
  }

  /**
   * Get all buildings
   */
  async getBuildings(): Promise<DatabaseResult> {
    return await this.db.executeQuery('SELECT * FROM buildings ORDER BY name');
  }

  /**
   * Create a new floor plan
   */
  async createFloorPlan(data: CreateFloorPlanInput): Promise<DatabaseResult> {
    return await this.db.executeUpdate(
      `INSERT INTO floor_plans 
       (building_id, name, bedrooms, bathrooms, has_den, square_footage, building_position, image_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.building_id,
        data.name,
        data.bedrooms,
        data.bathrooms,
        data.has_den || false,
        data.square_footage,
        data.building_position,
        data.image_url
      ]
    );
  }

  /**
   * Get floor plans with building information and latest pricing
   */
  async getFloorPlansWithPricing(): Promise<DatabaseResult> {
    return await this.db.executeQuery(`
      SELECT 
        fp.*,
        b.name as building_name,
        latest.price as current_price,
        latest.is_available,
        lowest.price as lowest_price,
        lowest.collection_date as lowest_price_date
      FROM floor_plans fp
      JOIN buildings b ON fp.building_id = b.id
      LEFT JOIN (
        SELECT DISTINCT floor_plan_id, 
               FIRST_VALUE(price) OVER (PARTITION BY floor_plan_id ORDER BY collection_date DESC) as price,
               FIRST_VALUE(is_available) OVER (PARTITION BY floor_plan_id ORDER BY collection_date DESC) as is_available
        FROM price_history
      ) latest ON fp.id = latest.floor_plan_id
      LEFT JOIN (
        SELECT DISTINCT floor_plan_id,
               MIN(price) as price,
               FIRST_VALUE(collection_date) OVER (PARTITION BY floor_plan_id ORDER BY price ASC, collection_date ASC) as collection_date
        FROM price_history
        GROUP BY floor_plan_id
      ) lowest ON fp.id = lowest.floor_plan_id
      ORDER BY b.name, fp.name
    `);
  }

  /**
   * Add price history record
   */
  async addPriceHistory(data: CreatePriceHistoryInput): Promise<DatabaseResult> {
    return await this.db.executeUpdate(
      'INSERT OR REPLACE INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
      [data.floor_plan_id, data.price, data.is_available, data.collection_date]
    );
  }

  /**
   * Get price history for a floor plan
   */
  async getPriceHistory(floorPlanId: number, startDate?: string, endDate?: string): Promise<DatabaseResult> {
    let query = 'SELECT * FROM price_history WHERE floor_plan_id = ?';
    const params: any[] = [floorPlanId];

    if (startDate) {
      query += ' AND collection_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND collection_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY collection_date DESC';

    return await this.db.executeQuery(query, params);
  }

  /**
   * Create an alert
   */
  async createAlert(data: CreateAlertInput): Promise<DatabaseResult> {
    return await this.db.executeUpdate(
      'INSERT INTO alerts (floor_plan_id, alert_type, old_price, new_price, percentage_change) VALUES (?, ?, ?, ?, ?)',
      [data.floor_plan_id, data.alert_type, data.old_price, data.new_price, data.percentage_change]
    );
  }

  /**
   * Get active alerts with floor plan and building information
   */
  async getActiveAlerts(): Promise<DatabaseResult> {
    return await this.db.executeQuery(`
      SELECT 
        a.*,
        fp.name as floor_plan_name,
        b.name as building_name
      FROM alerts a
      JOIN floor_plans fp ON a.floor_plan_id = fp.id
      JOIN buildings b ON fp.building_id = b.id
      WHERE a.is_dismissed = FALSE
      ORDER BY a.created_at DESC
    `);
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(alertId: number): Promise<DatabaseResult> {
    return await this.db.executeUpdate(
      'UPDATE alerts SET is_dismissed = TRUE WHERE id = ?',
      [alertId]
    );
  }

  /**
   * Update application setting
   */
  async updateSetting(key: string, value: string): Promise<DatabaseResult> {
    return await this.db.executeUpdate(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value]
    );
  }

  /**
   * Get application setting
   */
  async getSetting(key: string): Promise<DatabaseResult> {
    return await this.db.executeQuerySingle(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<DatabaseResult> {
    return await this.db.executeQuery('SELECT * FROM settings ORDER BY key');
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<DatabaseResult> {
    return await this.db.getStats();
  }

  /**
   * Clean up old price history records (keep only lowest daily price)
   */
  async cleanupPriceHistory(): Promise<DatabaseResult> {
    return await this.db.executeTransaction(async (database) => {
      // This query keeps only the lowest price for each floor plan per day
      await database.exec(`
        DELETE FROM price_history 
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id, 
                   ROW_NUMBER() OVER (
                     PARTITION BY floor_plan_id, collection_date 
                     ORDER BY price ASC, created_at ASC
                   ) as rn
            FROM price_history
          ) ranked
          WHERE rn = 1
        )
      `);

      return { message: 'Price history cleanup completed' };
    });
  }
}