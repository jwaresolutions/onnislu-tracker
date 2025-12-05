import { 
  DatabaseConnection, 
  getDatabaseConnection, 
  DatabaseUtils,
  Building,
  CreateBuildingInput,
  CreateFloorPlanInput,
  FloorPlan,
  PriceHistory,
  FloorPlanQuery,
  DatabaseResult
} from '../database';
import logger from '../utils/logger';
import type { ScrapedFloorPlan } from './ScraperService';
import alertService from './AlertService';

// Helper to format YYYY-MM-DD
function toDateOnly(d: Date | string): string {
  const date = (typeof d === 'string') ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export class DataService {
  private readonly db: DatabaseConnection;
  private readonly utils: DatabaseUtils;
  private initialized = false;

  constructor(db?: DatabaseConnection) {
    this.db = db ?? getDatabaseConnection();
    this.utils = new DatabaseUtils(this.db);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    const res = await this.db.initialize();
    if (!res.success) {
      throw new Error(`Database init failed: ${res.error}`);
    }
    this.initialized = true;
  }

  // Upsert building by unique name
  async upsertBuilding(input: CreateBuildingInput): Promise<{ id: number }> {
    await this.init();
    const insert = await this.db.executeUpdate(
      'INSERT INTO buildings (name, url) VALUES (?, ?)',
      [input.name, input.url]
    );
    if (insert.success) {
      return { id: insert.data.lastID };
    }
    // Handle unique violation by updating URL and returning id
    if (insert.error && insert.error.includes('UNIQUE')) {
      await this.db.executeUpdate(
        'UPDATE buildings SET url = ? WHERE name = ?',
        [input.url, input.name]
      );
      const row = await this.db.executeQuerySingle('SELECT id FROM buildings WHERE name = ?', [input.name]);
      if (row.success && row.data) return { id: row.data.id as number };
      throw new Error(`Failed to fetch existing building id for ${input.name}`);
    }
    throw new Error(insert.error || 'Unknown building upsert error');
  }

  // Upsert floor plan by unique (building_id, name)
  async upsertFloorPlan(input: CreateFloorPlanInput): Promise<{ id: number }> {
    await this.init();
    const insert = await this.db.executeUpdate(
      `INSERT INTO floor_plans 
       (building_id, name, bedrooms, bathrooms, has_den, square_footage, building_position, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.building_id,
        input.name,
        input.bedrooms,
        input.bathrooms,
        input.has_den ?? false,
        input.square_footage ?? null,
        input.building_position ?? null,
        input.image_url ?? null
      ]
    );
    if (insert.success) {
      return { id: insert.data.lastID };
    }
    if (insert.error && insert.error.includes('UNIQUE')) {
      // Only update dynamic fields (square_footage, building_position, image_url)
      // NEVER update static metadata (bedrooms, bathrooms, has_den)
      await this.db.executeUpdate(
        `UPDATE floor_plans 
         SET square_footage = ?, building_position = ?, image_url = ?
         WHERE building_id = ? AND name = ?`,
        [
          input.square_footage ?? null,
          input.building_position ?? null,
          input.image_url ?? null,
          input.building_id,
          input.name
        ]
      );
      const row = await this.db.executeQuerySingle(
        'SELECT id FROM floor_plans WHERE building_id = ? AND name = ?',
        [input.building_id, input.name]
      );
      if (row.success && row.data) return { id: row.data.id as number };
      throw new Error(`Failed to fetch existing floor plan id for ${input.name}`);
    }
    throw new Error(insert.error || 'Unknown floor plan upsert error');
  }

  // Record lowest price for a floor plan for given day, preserving the minimum
  async recordDailyPrice(input: { floor_plan_id: number; price: number; is_available: boolean; collection_date?: string | Date }): Promise<void> {
    await this.init();
    const date = toDateOnly(input.collection_date ?? new Date());
    const existing = await this.db.executeQuerySingle(
      'SELECT id, price, is_available FROM price_history WHERE floor_plan_id = ? AND collection_date = ?',
      [input.floor_plan_id, date]
    );
    if (existing.success && existing.data) {
      const row = existing.data as { id: number; price: number; is_available: number };
      // If price improves, update both price and availability; else only availability (OR)
      if (input.price < Number(row.price)) {
        await this.db.executeUpdate(
          'UPDATE price_history SET price = ?, is_available = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
          [input.price, input.is_available ? 1 : 0, row.id]
        );
        // Trigger alerts on improved (lower) price
        await alertService.onPriceRecorded({
          floor_plan_id: input.floor_plan_id,
          new_price: input.price,
          collection_date: date
        });
      } else {
        const mergedAvailable = (row.is_available ? 1 : 0) || (input.is_available ? 1 : 0);
        await this.db.executeUpdate(
          'UPDATE price_history SET is_available = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
          [mergedAvailable, row.id]
        );
      }
      return;
    }
    // No existing record for the day — insert
    await this.db.executeUpdate(
      'INSERT INTO price_history (floor_plan_id, price, is_available, collection_date) VALUES (?, ?, ?, ?)',
      [input.floor_plan_id, input.price, input.is_available ? 1 : 0, date]
    );
    // Trigger alerts on first record of the day (compares to historical prices)
    await alertService.onPriceRecorded({
      floor_plan_id: input.floor_plan_id,
      new_price: input.price,
      collection_date: date
    });
  }

  // Read: get all floor plans with enriched fields, optionally filtered
  async getAllFloorPlans(query: FloorPlanQuery = {}): Promise<DatabaseResult> {
    await this.init();
    const all = await this.utils.getFloorPlansWithPricing();
    if (!all.success) return all;
    let rows = all.data as FloorPlan[];
    if (query.building_id !== undefined) rows = rows.filter(r => r.building_id === query.building_id);
    if (query.bedrooms !== undefined) rows = rows.filter(r => r.bedrooms === query.bedrooms);
    if (query.bathrooms !== undefined) rows = rows.filter(r => Number(r.bathrooms) === Number(query.bathrooms));
    if (query.has_den !== undefined) rows = rows.filter(r => !!r.has_den === !!query.has_den);
    if (query.available_only) rows = rows.filter(r => !!r.is_available);
    return { success: true, data: rows };
  }

  // Read: get a single floor plan with latest/lowest
  async getFloorPlanById(id: number): Promise<DatabaseResult> {
    const all = await this.getAllFloorPlans({});
    if (!all.success) return all;
    const fp = (all.data as FloorPlan[]).find(r => r.id === id) || null;
    return { success: true, data: fp };
  }

  // Read: get price history for a floor plan with optional range and limit
  async getPriceHistory(floorPlanId: number, startDate?: string, endDate?: string, limit?: number): Promise<DatabaseResult> {
    await this.init();
    const params: any[] = [floorPlanId];
    let sql = 'SELECT * FROM price_history WHERE floor_plan_id = ?';
    if (startDate) { sql += ' AND collection_date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND collection_date <= ?'; params.push(endDate); }
    sql += ' ORDER BY collection_date DESC';
    if (limit && limit > 0) { sql += ' LIMIT ?'; params.push(limit); }
    return this.db.executeQuery(sql, params);
  }

  // Read: latest prices snapshot for all floor plans
  async getLatestPrices(): Promise<DatabaseResult> {
    await this.init();
    // Reuse the enriched view and project
    const res = await this.utils.getFloorPlansWithPricing();
    if (!res.success) return res;
    const nowIso = new Date().toISOString();
    const prices = (res.data as FloorPlan[]).map(fp => ({
      floor_plan_id: fp.id,
      floor_plan_name: fp.name,
      building_id: fp.building_id,
      building_name: fp.building_name,
      price: fp.current_price ?? null,
      is_available: fp.is_available ?? false
    }));
    return { success: true, data: { prices, lastUpdated: nowIso } };
  }

  // Cross-floor-plan price history with names (optional range/limit)
  async getPriceHistoryRange(startDate?: string, endDate?: string, limit?: number): Promise<DatabaseResult> {
    await this.init();
    const params: any[] = [];
    let sql = `
      SELECT
        ph.*,
        fp.name AS floor_plan_name,
        b.name AS building_name,
        fp.square_footage AS square_footage
      FROM price_history ph
      JOIN floor_plans fp ON ph.floor_plan_id = fp.id
      JOIN buildings b ON fp.building_id = b.id
      WHERE 1=1
    `;
    if (startDate) {
      sql += ' AND ph.collection_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND ph.collection_date <= ?';
      params.push(endDate);
    }
    sql += ' ORDER BY ph.collection_date DESC';
    if (limit && limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
    }
    return this.db.executeQuery(sql, params);
  }

  // Database health (connectivity & integrity)
  async checkHealth(): Promise<DatabaseResult> {
    await this.init();
    return this.db.checkHealth();
  }

  // Database statistics (counts)
  async getStatistics(): Promise<DatabaseResult> {
    await this.init();
    return this.utils.getStatistics();
  }

  // Settings helpers
  async getSetting(key: string): Promise<DatabaseResult> {
    await this.init();
    return this.utils.getSetting(key);
  }

  async getAllSettings(): Promise<DatabaseResult> {
    await this.init();
    return this.utils.getAllSettings();
  }

  async updateSetting(key: string, value: string): Promise<DatabaseResult> {
    await this.init();
    return this.utils.updateSetting(key, value);
  }

  async updateAlertSettings(thresholdType: 'dollar' | 'percentage', thresholdValue: number): Promise<DatabaseResult> {
    await this.init();
    const r1 = await this.updateSetting('alert_threshold_type', thresholdType);
    if (!r1.success) return r1;
    return this.updateSetting('alert_threshold_value', String(thresholdValue));
  }

  // Alerts
  async getActiveAlerts(): Promise<DatabaseResult> {
    await this.init();
    return this.utils.getActiveAlerts();
  }

  async dismissAlert(alertId: number): Promise<DatabaseResult> {
    await this.init();
    return this.utils.dismissAlert(alertId);
  }

  // Persist a scraping result for a building
  async persistScrapedFloorPlans(building: Pick<Building, 'name' | 'url'>, floorPlans: ScrapedFloorPlan[], collectedAt?: Date): Promise<{ buildingId: number; upserted: number; priced: number; }> {
    await this.init();
    const date = toDateOnly(collectedAt ?? new Date());
    const stats = { buildingId: 0, upserted: 0, priced: 0 };
    const trx = await this.db.executeTransaction(async (database) => {
      // Upsert building
      const b = await this.upsertBuilding({ name: building.name, url: building.url });
      stats.buildingId = b.id;
      // Process floor plans
      for (const fp of floorPlans) {
        try {
          const up = await this.upsertFloorPlan({
            building_id: b.id,
            name: fp.name,
            bedrooms: fp.bedrooms,
            bathrooms: fp.bathrooms,
            has_den: fp.hasDen,
            square_footage: fp.squareFootage || undefined,
            building_position: fp.buildingPosition || undefined,
            image_url: fp.imageUrl || undefined
          });
          stats.upserted++;
          await this.recordDailyPrice({
            floor_plan_id: up.id,
            price: fp.price,
            is_available: fp.isAvailable,
            collection_date: date
          });
          stats.priced++;
        } catch (err) {
          logger.error('persistScrapedFloorPlans item failed', { name: fp.name, error: err });
        }
      }
      return stats;
    });
    if (!trx.success) {
      throw new Error(trx.error || 'Transaction failed');
    }
    return trx.data!;
  }

  // SecureCafe availability cache (JSON blob stored in settings)
  async getSecureCafeAvailabilityCache(): Promise<{ data: any | null; time: string | null }> {
    await this.init();
    const jsonRes = await this.getSetting('securecafe_availability_json');
    const timeRes = await this.getSetting('securecafe_availability_time');
    const json = jsonRes.success ? (jsonRes.data as any)?.value : null;
    const time = timeRes.success ? String((timeRes.data as any)?.value || '') : null;
    let data: any | null = null;
    try {
      data = json ? JSON.parse(json) : null;
    } catch {
      data = null;
    }
    return { data, time: time || null };
  }

  async setSecureCafeAvailabilityCache(payload: any, when?: Date | string): Promise<void> {
    await this.init();
    const serialized = JSON.stringify(payload ?? {});
    const ts = typeof when === 'string' ? when : new Date().toISOString();
    await this.updateSetting('securecafe_availability_json', serialized);
    await this.updateSetting('securecafe_availability_time', ts);
  }
}
 
// Singleton export for convenience
export const dataService = new DataService();
export default dataService;