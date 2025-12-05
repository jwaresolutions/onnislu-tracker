import { Request, Response, NextFunction } from 'express';
import { validate, schemas } from '../middleware/validation';
import { errorHandler, AppError, asyncHandler } from '../middleware/errorHandler';

// Mock logger to avoid file system operations in tests
jest.mock('../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

describe('Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      path: '/test',
      method: 'GET',
      body: {},
      query: {},
      params: {},
      get: jest.fn().mockReturnValue('test-header'),
      ip: '127.0.0.1'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('Validation Middleware', () => {
    it('should pass validation with valid data', () => {
      mockReq.body = {
        thresholdType: 'percentage',
        thresholdValue: 10
      };

      const middleware = validate(schemas.alertSettings, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid data', () => {
      mockReq.body = {
        thresholdType: 'invalid',
        thresholdValue: -5
      };

      const middleware = validate(schemas.alertSettings, 'body');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate query parameters', () => {
      mockReq.query = {
        start: 'invalid-date'
      };

      const middleware = validate(schemas.dateRange, 'query');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate URL parameters', () => {
      mockReq.params = {
        id: 'invalid'
      };

      const middleware = validate(schemas.floorPlanId, 'params');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error Handler Middleware', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError('Test error', 400);
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'OPERATIONAL_ERROR',
          message: 'Test error'
        }
      });
    });

    it('should handle generic errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // Set to production to avoid stack trace
      
      const error = new Error('Generic error');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'SYSTEM_ERROR',
          message: 'Internal Server Error' // Error handler masks generic errors in production
        }
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          type: 'SYSTEM_ERROR',
          message: 'Internal Server Error', // Error handler masks all errors
          stack: expect.any(String)
        }
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Async Handler', () => {
    it('should handle successful async operations', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and forward async errors', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(mockReq as Request, mockRes as Response, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('Validation Schemas', () => {
    it('should validate date range schema', () => {
      const validData = {
        start: '2024-01-01',
        end: '2024-12-31',
        limit: 100
      };

      const { error } = schemas.dateRange.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should validate floor plan ID schema', () => {
      const validData = { id: 1 };
      const { error } = schemas.floorPlanId.validate(validData);
      expect(error).toBeUndefined();

      const invalidData = { id: 0 };
      const { error: invalidError } = schemas.floorPlanId.validate(invalidData);
      expect(invalidError).toBeDefined();
    });

    it('should validate alert settings schema', () => {
      const validData = {
        thresholdType: 'dollar',
        thresholdValue: 50
      };

      const { error } = schemas.alertSettings.validate(validData);
      expect(error).toBeUndefined();
    });
  });
});