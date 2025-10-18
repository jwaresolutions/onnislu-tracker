import { Response } from 'express';
import dataService from './DataService';
import logger from '../utils/logger';

export interface PriceHistoryExportOptions {
  start?: string;
  end?: string;
  limit?: number;
  filenamePrefix?: string; // default: price_history
  includeHeader?: boolean; // default: true
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const MM = String(now.getMinutes()).padStart(2, '0');
  const SS = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${HH}${MM}${SS}`;
}

export class ExportService {
  /**
   * Streams price history as CSV into the provided Express Response.
   * Columns:
   * - floor_plan
   * - building
   * - date
   * - price
   * - is_available
   * - sqft
   */
  async streamPriceHistoryCSV(res: Response, opts: PriceHistoryExportOptions = {}): Promise<void> {
    const {
      start,
      end,
      limit,
      filenamePrefix = 'price_history',
      includeHeader = true,
    } = opts;

    logger.info('ExportService.streamPriceHistoryCSV start', { start, end, limit, includeHeader });

    const result = await dataService.getPriceHistoryRange(start, end, limit);
    if (!result.success) {
      const errMsg = result.error || 'Failed to build CSV export';
      logger.error('ExportService.streamPriceHistoryCSV query failed', { error: errMsg });
      throw new Error(errMsg);
    }

    const rows: any[] = Array.isArray(result.data) ? result.data : [];
    const filename = `${filenamePrefix}_${buildTimestamp()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // header
    if (includeHeader) {
      const header = ['floor_plan', 'building', 'date', 'price', 'is_available', 'sqft']
        .map(csvEscape)
        .join(',') + '\n';
      res.write(header);
    }

    // rows
    for (const r of rows) {
      const line = [
        csvEscape(r.floor_plan_name),
        csvEscape(r.building_name),
        csvEscape(r.collection_date),
        csvEscape(r.price),
        csvEscape((r.is_available === true || r.is_available === 1) ? 'true' : 'false'),
        csvEscape(r.square_footage ?? '')
      ].join(',') + '\n';
      res.write(line);
    }

    res.end();

    logger.info('ExportService.streamPriceHistoryCSV completed', { rowCount: rows.length, filename });
  }
}

const exportService = new ExportService();
export default exportService;