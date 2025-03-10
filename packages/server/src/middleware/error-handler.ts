import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/error';
import { createLogger } from '../utils/logger';

const logger = createLogger('error-handler');

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('API error:', err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        type: err.type || 'api_error',
        code: err.statusCode,
      },
    });
  } else {
    // Handle unexpected errors
    res.status(500).json({
      error: {
        message: 'An unexpected error occurred',
        type: 'server_error',
        code: 500,
      },
    });
  }
}
