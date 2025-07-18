import { Request, Response, NextFunction } from 'express';
import { AccessControlService } from '../../modules/access-control/access-control-service';
import { ApiResponse, AuthUser } from '../../shared/types';
import { AuthenticatedRequest } from './auth-middleware';

export function createPermissionsMiddleware(accessControlService: AccessControlService) {
  return {
    validatePermissions: (requiredPermissions: string[]) => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) {
            const response: ApiResponse = {
              success: false,
              message: 'Authentication required',
              errors: ['User must be authenticated to access this resource']
            };
            return res.status(401).json(response);
          }

          const userPermissions = req.user.permissions;

          if (!userPermissions) {
            const response: ApiResponse = {
              success: false,
              message: 'Permission validation failed',
              errors: ['User permissions could not be determined']
            };
            return res.status(403).json(response);
          }

          // Check if user has all required permissions
          const missingPermissions = [];

          for (const permission of requiredPermissions) {
            if (!hasPermission(userPermissions, permission)) {
              missingPermissions.push(permission);
            }
          }

          if (missingPermissions.length > 0) {
            const response: ApiResponse = {
              success: false,
              message: 'Insufficient permissions',
              errors: [`Missing permissions: ${missingPermissions.join(', ')}`]
            };
            return res.status(403).json(response);
          }

          next();
        } catch (error) {
          const response: ApiResponse = {
            success: false,
            message: 'Permission validation error',
            errors: [error instanceof Error ? error.message : 'Unknown error occurred']
          };
          res.status(500).json(response);
        }
      };
    },

    validateEpicAccess: (action: 'view' | 'edit' | 'delete' = 'view') => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) {
            const response: ApiResponse = {
              success: false,
              message: 'Authentication required',
              errors: ['User must be authenticated to access this resource']
            };
            return res.status(401).json(response);
          }

          const epicId = parseInt(req.params.id || req.params.epicId);

          if (!epicId) {
            const response: ApiResponse = {
              success: false,
              message: 'Epic ID required',
              errors: ['Epic ID must be provided in the request parameters']
            };
            return res.status(400).json(response);
          }

          const hasAccess = await accessControlService.hasEpicAccess(req.user.id, epicId, action);

          if (!hasAccess) {
            const response: ApiResponse = {
              success: false,
              message: 'Access denied',
              errors: [`You do not have permission to ${action} this epic`]
            };
            return res.status(403).json(response);
          }

          next();
        } catch (error) {
          const response: ApiResponse = {
            success: false,
            message: 'Access validation error',
            errors: [error instanceof Error ? error.message : 'Unknown error occurred']
          };
          res.status(500).json(response);
        }
      };
    },

    validatePhaseAccess: () => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) {
            const response: ApiResponse = {
              success: false,
              message: 'Authentication required',
              errors: ['User must be authenticated to access this resource']
            };
            return res.status(401).json(response);
          }

          const epicId = parseInt(req.params.epicId);
          const phaseId = parseInt(req.params.phaseId || req.body.phase_id);

          if (!epicId || !phaseId) {
            const response: ApiResponse = {
              success: false,
              message: 'Epic ID and Phase ID required',
              errors: ['Both Epic ID and Phase ID must be provided']
            };
            return res.status(400).json(response);
          }

          const hasAccess = await accessControlService.hasPhaseAccess(req.user.id, epicId, phaseId);

          if (!hasAccess) {
            const response: ApiResponse = {
              success: false,
              message: 'Phase access denied',
              errors: ['You do not have permission to access this phase']
            };
            return res.status(403).json(response);
          }

          next();
        } catch (error) {
          const response: ApiResponse = {
            success: false,
            message: 'Phase access validation error',
            errors: [error instanceof Error ? error.message : 'Unknown error occurred']
          };
          res.status(500).json(response);
        }
      };
    },

    validateCustomerPortalAccess: () => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) {
            const response: ApiResponse = {
              success: false,
              message: 'Authentication required',
              errors: ['User must be authenticated to access this resource']
            };
            return res.status(401).json(response);
          }

          const epicId = parseInt(req.params.epicId);

          if (!epicId) {
            const response: ApiResponse = {
              success: false,
              message: 'Epic ID required',
              errors: ['Epic ID must be provided in the request parameters']
            };
            return res.status(400).json(response);
          }

          const hasAccess = await accessControlService.canAccessCustomerPortal(req.user.id, epicId);

          if (!hasAccess) {
            const response: ApiResponse = {
              success: false,
              message: 'Customer portal access denied',
              errors: ['You do not have permission to access this customer portal']
            };
            return res.status(403).json(response);
          }

          next();
        } catch (error) {
          const response: ApiResponse = {
            success: false,
            message: 'Customer portal access validation error',
            errors: [error instanceof Error ? error.message : 'Unknown error occurred']
          };
          res.status(500).json(response);
        }
      };
    },

    validateAssignmentPermission: () => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          if (!req.user) {
            const response: ApiResponse = {
              success: false,
              message: 'Authentication required',
              errors: ['User must be authenticated to access this resource']
            };
            return res.status(401).json(response);
          }

          const assigneeId = parseInt(req.body.assignee_id);
          const epicId = parseInt(req.params.epicId);

          if (!assigneeId || !epicId) {
            // If no assignment is being made, continue
            return next();
          }

          const canAssign = await accessControlService.canAssignTask(req.user.id, assigneeId, epicId);

          if (!canAssign) {
            const response: ApiResponse = {
              success: false,
              message: 'Assignment permission denied',
              errors: ['You do not have permission to assign tasks in this project']
            };
            return res.status(403).json(response);
          }

          next();
        } catch (error) {
          const response: ApiResponse = {
            success: false,
            message: 'Assignment permission validation error',
            errors: [error instanceof Error ? error.message : 'Unknown error occurred']
          };
          res.status(500).json(response);
        }
      };
    },

    attachUserContext: () => {
      return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        // Attach user ID to request body for tracking purposes
        if (req.user && req.method !== 'GET') {
          if (!req.body.created_by && !req.body.updated_by) {
            if (req.method === 'POST') {
              req.body.created_by = req.user.id;
            } else if (req.method === 'PUT' || req.method === 'PATCH') {
              req.body.updated_by = req.user.id;
            }
          }
        }
        next();
      };
    },

    logUserAction: (action: string) => {
      return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        // Attach action metadata for audit logging
        req.auditAction = {
          action,
          user_id: req.user?.id,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          timestamp: new Date()
        };
        next();
      };
    }
  };
}

// Helper function to check permissions
function hasPermission(userPermissions: any, permission: string): boolean {
  const permissionKeys = permission.split('.');
  let current = userPermissions;

  for (const key of permissionKeys) {
    if (current[key] === undefined) {
      return false;
    }
    current = current[key];
  }

  return Boolean(current);
}

// Extend Request interface for audit metadata
declare global {
  namespace Express {
    interface Request {
      auditAction?: {
        action: string;
        user_id?: number;
        ip_address?: string;
        user_agent?: string;
        timestamp: Date;
      };
    }
  }
}