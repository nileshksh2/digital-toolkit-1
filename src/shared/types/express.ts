import { Request } from 'express';
import { AuthUser } from './index';

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Export the extended Request type
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export interface RequestWithUser extends Request {
  user?: AuthUser;
}