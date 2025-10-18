// AlertService: detect price drops and lowest-ever prices, persist alerts.
// No circular imports: uses raw DB connection and DatabaseUtils.

import { getDatabaseConnection, DatabaseUtils } from '../database';
import logger from '../utils/logger';

export type ThresholdType = 'dollar' | 'percentage';

export interface AlertContext {
  floor_plan_id: number;
  new_price: number;
  collection_date: string; // YYYY-MM-DD
}

export class AlertService {
  async onPriceRecorded(ctx: AlertContext): Promise<void> {
    try {
      const db = getDatabaseConnection();
      const utils = new DatabaseUtils(db);
      await db.initialize();

      // Load alert settings
      const tTypeRes = await utils.getSetting('alert_threshold_type');
      const tValRes = await utils.getSetting('alert_threshold_value');

      const thresholdType: ThresholdType =
        (tTypeRes.success && tTypeRes.data?.value === 'dollar') ? 'dollar' : 'percentage';

      const thresholdValueRaw = (tValRes.success && tValRes.data?.value) ? Number(tValRes.data.value) : undefined;
      const thresholdValue = Number.isFinite(thresholdValueRaw) ? Number(thresholdValueRaw) : 5; // default 5%

      // Fetch previous latest price BEFORE today's date to avoid same-day churn
      const prevRow = await db.executeQuerySingle(
        `
          SELECT price 
          FROM price_history 
          WHERE floor_plan_id = ? AND collection_date < ?
          ORDER BY collection_date DESC, created_at DESC
          LIMIT 1
        `,
        [ctx.floor_plan_id, ctx.collection_date]
      );

      const prevPrice: number | null = prevRow.success && prevRow.data ? Number(prevRow.data.price) : null;

      // Fetch historical lowest price so far (before today)
      const lowestRow = await db.executeQuerySingle(
        `
          SELECT MIN(price) AS price
          FROM price_history
          WHERE floor_plan_id = ? AND collection_date < ?
        `,
        [ctx.floor_plan_id, ctx.collection_date]
      );
      const historicalLowest: number | null =
        lowestRow.success && lowestRow.data && lowestRow.data.price != null
          ? Number(lowestRow.data.price)
          : null;

      // Determine price drop alert
      if (prevPrice != null && ctx.new_price < prevPrice) {
        const diff = prevPrice - ctx.new_price;
        const pct = prevPrice > 0 ? (diff / prevPrice) * 100 : 0;

        const meetsThreshold =
          thresholdType === 'dollar'
            ? diff >= thresholdValue
            : pct >= thresholdValue;

        if (meetsThreshold) {
          await utils.createAlert({
            floor_plan_id: ctx.floor_plan_id,
            alert_type: 'price_drop',
            old_price: prevPrice,
            new_price: ctx.new_price,
            percentage_change: Number(pct.toFixed(2))
          });
          logger.info('AlertService: price_drop alert created', {
            floor_plan_id: ctx.floor_plan_id,
            old_price: prevPrice,
            new_price: ctx.new_price,
            pct: Number(pct.toFixed(2))
          });
        }
      }

      // Determine lowest-ever alert
      if (historicalLowest == null || ctx.new_price < historicalLowest) {
        // Only alert if we have at least one historical price (avoid first-ever insert unless requested)
        if (historicalLowest != null) {
          await utils.createAlert({
            floor_plan_id: ctx.floor_plan_id,
            alert_type: 'lowest_price',
            old_price: historicalLowest,
            new_price: ctx.new_price,
            percentage_change:
              historicalLowest > 0 ? Number((((historicalLowest - ctx.new_price) / historicalLowest) * 100).toFixed(2)) : undefined
          });
          logger.info('AlertService: lowest_price alert created', {
            floor_plan_id: ctx.floor_plan_id,
            old_low: historicalLowest,
            new_low: ctx.new_price
          });
        }
      }
    } catch (err) {
      logger.error('AlertService.onPriceRecorded error', { error: err instanceof Error ? err.message : String(err) });
    }
  }
}

const alertService = new AlertService();
export default alertService;