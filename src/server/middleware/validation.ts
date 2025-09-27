import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

// Generic validation middleware factory
export const validate = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req[property]);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      logger.warn('Validation error', {
        endpoint: req.path,
        method: req.method,
        property,
        error: errorMessage,
        data: req[property]
      });
      
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errorMessage
        }
      });
    }
    
    next();
  };
};

// Common validation schemas
export const schemas = {
  // Query parameters for date ranges
  dateRange: Joi.object({
    start: Joi.date().iso().optional(),
    end: Joi.date().iso().optional(),
    limit: Joi.number().integer().min(1).max(1000).optional()
  }),
  
  // Floor plan ID parameter
  floorPlanId: Joi.object({
    id: Joi.number().integer().positive().required()
  }),
  
  // Alert settings
  alertSettings: Joi.object({
    thresholdType: Joi.string().valid('dollar', 'percentage').required(),
    thresholdValue: Joi.number().positive().required()
  }),
  
  // Alert dismissal
  alertId: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};