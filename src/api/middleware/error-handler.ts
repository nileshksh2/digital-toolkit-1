import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ValidationError, NotFoundError, ForbiddenError, ApplicationError } from '../../shared/types';

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', error);

  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  let response: ApiResponse;

  if (error instanceof ValidationError) {
    response = {
      success: false,
      message: error.message,
      errors: error.details ? [error.details] : [error.message]
    };
    res.status(400).json(response);
  } else if (error instanceof NotFoundError) {
    response = {
      success: false,
      message: error.message,
      errors: [error.message]
    };
    res.status(404).json(response);
  } else if (error instanceof ForbiddenError) {
    response = {
      success: false,
      message: error.message,
      errors: [error.message]
    };
    res.status(403).json(response);
  } else if (error instanceof ApplicationError) {
    response = {
      success: false,
      message: error.message,
      errors: [error.message]
    };
    res.status(error.statusCode).json(response);
  } else if (error.name === 'JsonWebTokenError') {
    response = {
      success: false,
      message: 'Invalid token',
      errors: ['Authentication token is invalid']
    };
    res.status(401).json(response);
  } else if (error.name === 'TokenExpiredError') {
    response = {
      success: false,
      message: 'Token expired',
      errors: ['Authentication token has expired']
    };
    res.status(401).json(response);
  } else if (error.code === 'ENOENT') {
    response = {
      success: false,
      message: 'File not found',
      errors: ['The requested file could not be found']
    };
    res.status(404).json(response);
  } else {
    // Generic server error
    response = {
      success: false,
      message: 'Internal server error',
      errors: ['An unexpected error occurred']
    };
    
    // Include error details in development
    if (process.env.NODE_ENV === 'development') {
      response.errors = [error.message || 'An unexpected error occurred'];
      response.stack = error.stack;
    }
    
    res.status(500).json(response);
  }
}