import { Request, Response, NextFunction } from 'express';
import { error, ErrorCodes } from '../utils/response';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json(
      error(ErrorCodes.VALIDATION_ERROR, err.message || 'Validation failed')
    );
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json(
      error(ErrorCodes.UNAUTHORIZED, 'Unauthorized access')
    );
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(
      error(ErrorCodes.UNAUTHORIZED, 'Invalid token')
    );
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(
      error(ErrorCodes.UNAUTHORIZED, 'Token expired')
    );
  }

  // Handle Multer file upload errors
  if (err instanceof Error && err.message === 'Only PNG files are allowed') {
    return res.status(400).json(
      error(ErrorCodes.VALIDATION_ERROR, 'Only PNG files are allowed')
    );
  }

  if (err instanceof Error && err.name === 'MulterError') {
    if (err.message.includes('File too large')) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'File size exceeds 4MB limit')
      );
    }
    return res.status(400).json(
      error(ErrorCodes.VALIDATION_ERROR, err.message || 'File upload error')
    );
  }

  // Default error response
  res.status(500).json(
    error(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred')
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(
    error(ErrorCodes.NOT_FOUND, `Route ${req.method} ${req.path} not found`)
  );
}