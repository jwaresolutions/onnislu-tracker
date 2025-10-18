import { Router, Request, Response } from 'express';
import { validate, schemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import dataService from '../services/DataService';

const router = Router();

// GET /api/alerts - Get active alerts
router.get('/', asyncHandler(async (req: Request, res: Response) => {
 logger.info('Fetching active alerts');

 const result = await dataService.getActiveAlerts();
 if (!result.success) {
   return res.status(500).json({ success: false, error: result.error || 'Failed to fetch alerts' });
 }

 res.json({
   success: true,
   data: {
     alerts: result.data
   }
 });
}));

// POST /api/alerts/settings - Update alert thresholds
router.post('/settings',
 validate(schemas.alertSettings, 'body'),
 asyncHandler(async (req: Request, res: Response) => {
   const { thresholdType, thresholdValue } = req.body as { thresholdType: 'dollar' | 'percentage'; thresholdValue: number };

   logger.info('Updating alert settings', { thresholdType, thresholdValue });

   const update = await dataService.updateAlertSettings(thresholdType, Number(thresholdValue));
   if (!update.success) {
     return res.status(500).json({ success: false, error: update.error || 'Failed to update alert settings' });
   }

   res.json({
     success: true,
     data: {
       settings: { thresholdType, thresholdValue: Number(thresholdValue) }
     }
   });
 })
);

// DELETE /api/alerts/:id - Dismiss alert
router.delete('/:id',
 validate(schemas.alertId, 'params'),
 asyncHandler(async (req: Request, res: Response) => {
   const { id } = req.params;

   logger.info('Dismissing alert', { alertId: id });

   const result = await dataService.dismissAlert(Number(id));
   if (!result.success) {
     return res.status(500).json({ success: false, error: result.error || 'Failed to dismiss alert' });
   }

   res.json({
     success: true,
     data: {
       alertId: Number(id),
       dismissed: true
     }
   });
 })
);

export default router;