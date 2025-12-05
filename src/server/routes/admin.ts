import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import dataService from '../services/DataService';
import logger from '../utils/logger';

const router = Router();

// GET /api/admin/floorplans - Get all floor plans with full metadata
router.get(
  '/floorplans',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await dataService.getAllFloorPlans({});
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch floor plans'
      });
    }

    return res.json({
      success: true,
      data: result.data
    });
  })
);

// PUT /api/admin/floorplans/:id - Update floor plan metadata
router.put(
  '/floorplans/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { name, bedrooms, bathrooms, has_den, square_footage } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid floor plan ID'
      });
    }

    // Validate input
    if (typeof bedrooms !== 'number' || bedrooms < 0) {
      return res.status(400).json({
        success: false,
        error: 'Bedrooms must be a non-negative number'
      });
    }

    if (typeof bathrooms !== 'number' || bathrooms < 1) {
      return res.status(400).json({
        success: false,
        error: 'Bathrooms must be at least 1'
      });
    }

    // Update the floor plan
    await dataService.init();
    const conn = (dataService as any).db; // Access private db property
    const updateResult = await conn.executeUpdate(
      `UPDATE floor_plans 
       SET name = ?,
           bedrooms = ?, 
           bathrooms = ?, 
           has_den = ?,
           square_footage = ?,
           bathrooms_estimated = 0
       WHERE id = ?`,
      [name, bedrooms, bathrooms, has_den ? 1 : 0, square_footage || null, id]
    );

    if (!updateResult.success) {
      logger.error('Failed to update floor plan', { id, error: updateResult.error });
      return res.status(500).json({
        success: false,
        error: updateResult.error || 'Failed to update floor plan'
      });
    }

    logger.info('Floor plan updated via admin', { id, name, bedrooms, bathrooms, has_den });

    return res.json({
      success: true,
      message: 'Floor plan updated successfully'
    });
  })
);

// DELETE /api/admin/floorplans/:id - Delete floor plan
router.delete(
  '/floorplans/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid floor plan ID'
      });
    }

    await dataService.init();
    const conn = (dataService as any).db; // Access private db property
    const deleteResult = await conn.executeUpdate(
      'DELETE FROM floor_plans WHERE id = ?',
      [id]
    );

    if (!deleteResult.success) {
      logger.error('Failed to delete floor plan', { id, error: deleteResult.error });
      return res.status(500).json({
        success: false,
        error: deleteResult.error || 'Failed to delete floor plan'
      });
    }

    logger.info('Floor plan deleted via admin', { id });

    return res.json({
      success: true,
      message: 'Floor plan deleted successfully'
    });
  })
);

export default router;
