import { Router, Request, Response } from 'express';
import { validate, schemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';
import dataService from '../services/DataService';

const router = Router();

// GET /api/floorplans - Get all floor plans with latest data
router.get('/', asyncHandler(async (req: Request, res: Response) => {
 logger.info('Fetching all floor plans');

 const { building_id, bedrooms, bathrooms, has_den, available_only } = req.query;

 const query: any = {
   building_id: building_id !== undefined ? Number(building_id) : undefined,
   bedrooms: bedrooms !== undefined ? Number(bedrooms) : undefined,
   bathrooms: bathrooms !== undefined ? Number(bathrooms) : undefined,
   has_den: has_den !== undefined ? (has_den === 'true' || has_den === '1') : undefined,
   available_only: available_only !== undefined ? (available_only === 'true' || available_only === '1') : undefined
 };

 const result = await dataService.getAllFloorPlans(query);
 if (!result.success) {
   return res.status(500).json({ success: false, error: result.error || 'Failed to fetch floor plans' });
 }

 res.json({
   success: true,
   data: {
     floorPlans: result.data
   }
 });
}));

// GET /api/floorplans/:id - Get specific floor plan details
router.get('/:id',
 validate(schemas.floorPlanId, 'params'),
 asyncHandler(async (req: Request, res: Response) => {
   const { id } = req.params;
   logger.info('Fetching floor plan details', { floorPlanId: id });

   const result = await dataService.getFloorPlanById(Number(id));
   if (!result.success) {
     return res.status(500).json({ success: false, error: result.error || 'Failed to fetch floor plan' });
   }

   if (!result.data) {
     return res.status(404).json({ success: false, error: 'Floor plan not found' });
   }

   res.json({
     success: true,
     data: {
       floorPlan: result.data
     }
   });
 })
);

// GET /api/floorplans/:id/history - Get price history for floor plan
router.get('/:id/history',
 validate(schemas.floorPlanId, 'params'),
 validate(schemas.dateRange, 'query'),
 asyncHandler(async (req: Request, res: Response) => {
   const { id } = req.params;
   const { start, end, limit } = req.query;

   logger.info('Fetching floor plan price history', {
     floorPlanId: id,
     start,
     end,
     limit
   });

   const startStr = typeof start === 'string' ? start : undefined;
   const endStr = typeof end === 'string' ? end : undefined;
   const limitNum = typeof limit === 'string' ? Number(limit) : (typeof limit === 'number' ? limit : undefined);

   const result = await dataService.getPriceHistory(Number(id), startStr, endStr, limitNum);
   if (!result.success) {
     return res.status(500).json({ success: false, error: result.error || 'Failed to fetch price history' });
   }

   res.json({
     success: true,
     data: {
       history: result.data
     }
   });
 })
);

export default router;