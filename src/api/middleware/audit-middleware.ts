import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../../modules/audit/audit-service';
import { AuthenticatedRequest } from './auth-middleware';
import { EntityType } from '../../shared/types';

export function createAuditMiddleware(auditService: AuditService) {
  return {
    // Middleware to automatically log actions based on route patterns
    auditAction: (action: string, entityType?: EntityType) => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        // Store audit metadata in request for later use
        req.auditMetadata = {
          action,
          entityType,
          userId: req.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date()
        };

        // Store original res.json to intercept successful responses
        const originalJson = res.json;

        res.json = function(body: any) {
          // Only log if the request was successful
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Extract entity ID from response or request params
            const entityId = body?.data?.id || 
                           parseInt(req.params.id) || 
                           parseInt(req.params.epicId) ||
                           parseInt(req.params.storyId) ||
                           parseInt(req.params.taskId) ||
                           parseInt(req.params.subtaskId);

            if (entityId && req.auditMetadata) {
              // Fire and forget audit logging
              auditService.logAction({
                user_id: req.auditMetadata.userId,
                action: req.auditMetadata.action,
                entity_type: req.auditMetadata.entityType || determineEntityType(req.path),
                entity_id: entityId,
                new_values: req.method === 'POST' ? body?.data : undefined,
                old_values: req.method === 'DELETE' ? { deleted: true } : undefined,
                ip_address: req.auditMetadata.ipAddress,
                user_agent: req.auditMetadata.userAgent
              }).catch(error => {
                console.error('Audit logging failed:', error);
              });
            }
          }

          return originalJson.call(this, body);
        };

        next();
      };
    },

    // Middleware for specific entity operations
    auditEpicOperation: (action: string) => {
      return createAuditMiddleware(auditService).auditAction(action, EntityType.EPIC);
    },

    auditStoryOperation: (action: string) => {
      return createAuditMiddleware(auditService).auditAction(action, EntityType.STORY);
    },

    auditTaskOperation: (action: string) => {
      return createAuditMiddleware(auditService).auditAction(action, EntityType.TASK);
    },

    auditSubtaskOperation: (action: string) => {
      return createAuditMiddleware(auditService).auditAction(action, EntityType.SUBTASK);
    },

    auditUserOperation: (action: string) => {
      return createAuditMiddleware(auditService).auditAction(action, EntityType.USER);
    },

    // Middleware to capture before/after values for updates
    captureBeforeUpdate: (entityType: EntityType, getEntityFunction: (id: number) => Promise<any>) => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
          const entityId = parseInt(req.params.id);
          
          if (entityId && (req.method === 'PUT' || req.method === 'PATCH')) {
            try {
              const beforeData = await getEntityFunction(entityId);
              req.beforeUpdateData = beforeData;
            } catch (error) {
              // Entity might not exist, continue anyway
              console.warn('Could not capture before-update data:', error);
            }
          }

          next();
        } catch (error) {
          next(error);
        }
      };
    },

    // Middleware to log update with before/after comparison
    auditUpdate: (entityType: EntityType) => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const originalJson = res.json;

        res.json = function(body: any) {
          if (res.statusCode >= 200 && res.statusCode < 300 && req.beforeUpdateData) {
            const entityId = body?.data?.id || parseInt(req.params.id);

            if (entityId && req.user) {
              // Extract only changed fields
              const changedFields = extractChangedFields(req.beforeUpdateData, body.data);

              if (Object.keys(changedFields.new_values).length > 0) {
                auditService.logAction({
                  user_id: req.user.id,
                  action: `${entityType.toUpperCase()}_UPDATED`,
                  entity_type: entityType,
                  entity_id: entityId,
                  old_values: changedFields.old_values,
                  new_values: changedFields.new_values,
                  ip_address: req.ip,
                  user_agent: req.get('User-Agent')
                }).catch(error => {
                  console.error('Audit update logging failed:', error);
                });
              }
            }
          }

          return originalJson.call(this, body);
        };

        next();
      };
    },

    // Middleware to log bulk operations
    auditBulkOperation: (action: string, entityType: EntityType) => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const originalJson = res.json;

        res.json = function(body: any) {
          if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
            const affectedIds = req.body.story_ids || req.body.task_ids || req.body.user_ids || [];

            if (affectedIds.length > 0) {
              // Log bulk operation
              auditService.logAction({
                user_id: req.user.id,
                action: action,
                entity_type: entityType,
                entity_id: 0, // Use 0 for bulk operations
                new_values: {
                  affected_ids: affectedIds,
                  bulk_updates: req.body.updates || req.body
                },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
              }).catch(error => {
                console.error('Audit bulk operation logging failed:', error);
              });
            }
          }

          return originalJson.call(this, body);
        };

        next();
      };
    },

    // Middleware to log authentication events
    auditAuthEvent: (action: string) => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const originalJson = res.json;

        res.json = function(body: any) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const userId = body?.data?.user?.id || req.user?.id;

            if (userId) {
              auditService.logAction({
                user_id: userId,
                action: action,
                entity_type: EntityType.USER,
                entity_id: userId,
                new_values: action === 'USER_LOGIN' ? { login_successful: true } : undefined,
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
              }).catch(error => {
                console.error('Audit auth event logging failed:', error);
              });
            }
          }

          return originalJson.call(this, body);
        };

        next();
      };
    },

    // Middleware to log permission changes
    auditPermissionChange: () => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const originalJson = res.json;

        res.json = function(body: any) {
          if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
            const targetUserId = parseInt(req.params.userId || req.body.user_id);
            const epicId = parseInt(req.params.epicId || req.body.epic_id);

            if (targetUserId) {
              const action = req.method === 'POST' ? 'PERMISSION_GRANTED' : 
                           req.method === 'DELETE' ? 'PERMISSION_REVOKED' : 
                           'PERMISSION_UPDATED';

              auditService.logAction({
                user_id: req.user.id,
                action: action,
                entity_type: EntityType.USER,
                entity_id: targetUserId,
                new_values: {
                  epic_id: epicId,
                  permission_level: req.body.permission_level,
                  phase_restrictions: req.body.phase_restrictions
                },
                ip_address: req.ip,
                user_agent: req.get('User-Agent')
              }).catch(error => {
                console.error('Audit permission change logging failed:', error);
              });
            }
          }

          return originalJson.call(this, body);
        };

        next();
      };
    }
  };
}

// Helper function to determine entity type from URL path
function determineEntityType(path: string): EntityType {
  if (path.includes('/epics')) return EntityType.EPIC;
  if (path.includes('/stories')) return EntityType.STORY;
  if (path.includes('/tasks')) return EntityType.TASK;
  if (path.includes('/subtasks')) return EntityType.SUBTASK;
  if (path.includes('/users')) return EntityType.USER;
  if (path.includes('/customers')) return EntityType.CUSTOMER;
  if (path.includes('/templates')) return EntityType.TEMPLATE;
  if (path.includes('/comments')) return EntityType.COMMENT;
  
  return EntityType.EPIC; // Default fallback
}

// Helper function to extract only changed fields
function extractChangedFields(oldData: any, newData: any): {
  old_values: Record<string, any>;
  new_values: Record<string, any>;
} {
  const old_values: Record<string, any> = {};
  const new_values: Record<string, any> = {};

  // Compare fields that exist in newData
  for (const key in newData) {
    if (oldData.hasOwnProperty(key) && oldData[key] !== newData[key]) {
      // Skip metadata fields
      if (!['created_at', 'updated_at', 'id'].includes(key)) {
        old_values[key] = oldData[key];
        new_values[key] = newData[key];
      }
    }
  }

  return { old_values, new_values };
}

// Extend Request interface for audit metadata
declare global {
  namespace Express {
    interface Request {
      auditMetadata?: {
        action: string;
        entityType?: EntityType;
        userId?: number;
        ipAddress?: string;
        userAgent?: string;
        timestamp: Date;
      };
      beforeUpdateData?: any;
    }
  }
}