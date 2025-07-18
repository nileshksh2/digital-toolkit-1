import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../modules/access-control/auth-service';
import { ApiResponse, AuthUser } from '../../shared/types';
import { UnauthorizedError } from '../../shared/types';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function createAuthMiddleware(authService: AuthService) {
  return {
    authenticateToken: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
          const response: ApiResponse = {
            success: false,
            message: 'Access token required',
            errors: ['Authorization header with Bearer token is required']
          };
          return res.status(401).json(response);
        }

        const user = await authService.validateToken(token);
        req.user = user;
        next();
      } catch (error) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid or expired token',
          errors: [error instanceof Error ? error.message : 'Authentication failed']
        };
        res.status(401).json(response);
      }
    },

    authenticateOptional: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
          try {
            const user = await authService.validateToken(token);
            req.user = user;
          } catch {
            // Ignore token validation errors for optional authentication
          }
        }

        next();
      } catch (error) {
        next(error);
      }
    },

    requireRole: (allowedRoles: string[]) => {
      return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
          const response: ApiResponse = {
            success: false,
            message: 'Authentication required',
            errors: ['User must be authenticated to access this resource']
          };
          return res.status(401).json(response);
        }

        if (!allowedRoles.includes(req.user.role)) {
          const response: ApiResponse = {
            success: false,
            message: 'Insufficient permissions',
            errors: [`Access denied. Required roles: ${allowedRoles.join(', ')}`]
          };
          return res.status(403).json(response);
        }

        next();
      };
    },

    requireSystemAdmin: (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated to access this resource']
        };
        return res.status(401).json(response);
      }

      if (req.user.role !== 'system_admin') {
        const response: ApiResponse = {
          success: false,
          message: 'System administrator access required',
          errors: ['Only system administrators can access this resource']
        };
        return res.status(403).json(response);
      }

      next();
    },

    requireProjectManager: (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated to access this resource']
        };
        return res.status(401).json(response);
      }

      if (!['system_admin', 'project_manager'].includes(req.user.role)) {
        const response: ApiResponse = {
          success: false,
          message: 'Project manager access required',
          errors: ['Only system administrators and project managers can access this resource']
        };
        return res.status(403).json(response);
      }

      next();
    }
  };
}