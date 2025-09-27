import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handling middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON in request body';
    isOperational = true;
    
    logger.warn('Invalid JSON in request body', {
      endpoint: req.path,
      method: req.method,
      error: err.message,
      ip: req.ip
    });

    return res.status(statusCode).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        message
      }
    });
  }

  // Log error details
  logger.error('Request error', {
    endpoint: req.path,
    method: req.method,
    statusCode,
    message: err.message,
    stack: err.stack,
    isOperational,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      type: isOperational ? 'OPERATIONAL_ERROR' : 'SYSTEM_ERROR',
      message: process.env.NODE_ENV === 'production' && !isOperational 
        ? 'Internal Server Error' 
        : message
    }
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    (errorResponse.error as any).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route not found', {
    endpoint: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: {
      type: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};