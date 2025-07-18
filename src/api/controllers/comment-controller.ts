import { Request, Response } from 'express';
import { CommentService } from '../../modules/comments/comment-service';
import { ApiResponse, EntityType, CommentType } from '../../shared/types';
import { ValidationError, NotFoundError, ApplicationError, ForbiddenError } from '../../shared/types';

export class CommentController {
  constructor(private commentService: CommentService) {}

  async createComment(req: Request, res: Response): Promise<void> {
    try {
      const { entity_type, entity_id, content, is_internal, parent_comment_id, mentions } = req.body;
      const author_id = req.user?.id;
      const attachments = req.files as Express.Multer.File[];

      if (!entity_type || !entity_id || !content || !author_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Missing required fields',
          errors: ['entity_type, entity_id, content are required']
        };
        res.status(400).json(response);
        return;
      }

      // Validate entity type
      if (!['epic', 'story', 'task', 'subtask'].includes(entity_type)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid entity type',
          errors: ['entity_type must be one of: epic, story, task, subtask']
        };
        res.status(400).json(response);
        return;
      }

      // Process attachments if any
      const attachmentData = attachments ? await this.processAttachments(attachments) : undefined;

      const comment = await this.commentService.createComment({
        entity_type: entity_type as EntityType,
        entity_id: parseInt(entity_id),
        content,
        is_internal: Boolean(is_internal),
        author_id,
        parent_comment_id: parent_comment_id ? parseInt(parent_comment_id) : undefined,
        attachments: attachmentData,
        mentions: mentions && Array.isArray(mentions) ? mentions.map(id => parseInt(id)) : undefined
      });

      const response: ApiResponse = {
        success: true,
        data: comment,
        message: 'Comment created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getComment(req: Request, res: Response): Promise<void> {
    try {
      const commentId = parseInt(req.params.id);

      if (!commentId || isNaN(commentId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid comment ID',
          errors: ['Comment ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const comment = await this.commentService.getCommentById(commentId);

      const response: ApiResponse = {
        success: true,
        data: comment
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getCommentsByEntity(req: Request, res: Response): Promise<void> {
    try {
      const { entity_type, entity_id } = req.params;
      const { include_internal, limit, offset, sort } = req.query;
      const user_id = req.user?.id;

      if (!entity_type || !entity_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Missing required parameters',
          errors: ['entity_type and entity_id are required']
        };
        res.status(400).json(response);
        return;
      }

      const entityIdNum = parseInt(entity_id);
      if (isNaN(entityIdNum)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid entity ID',
          errors: ['Entity ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const options: any = {
        user_id,
        include_internal: include_internal === 'true',
        sort: sort === 'asc' ? 'asc' : 'desc'
      };

      if (limit) {
        const limitNum = parseInt(limit as string);
        if (!isNaN(limitNum) && limitNum > 0) {
          options.limit = limitNum;
        }
      }

      if (offset) {
        const offsetNum = parseInt(offset as string);
        if (!isNaN(offsetNum) && offsetNum >= 0) {
          options.offset = offsetNum;
        }
      }

      const result = await this.commentService.getCommentsByEntity(
        entity_type as EntityType,
        entityIdNum,
        options
      );

      const response: ApiResponse = {
        success: true,
        data: result
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updateComment(req: Request, res: Response): Promise<void> {
    try {
      const commentId = parseInt(req.params.id);
      const { content, attachments } = req.body;
      const updated_by = req.user?.id;

      if (!commentId || isNaN(commentId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid comment ID',
          errors: ['Comment ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (!updated_by) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      const updates: any = { updated_by };

      if (content !== undefined) {
        if (typeof content !== 'string' || content.trim().length === 0) {
          const response: ApiResponse = {
            success: false,
            message: 'Content cannot be empty',
            errors: ['Comment content must be a non-empty string']
          };
          res.status(400).json(response);
          return;
        }
        updates.content = content;
      }

      if (attachments !== undefined) {
        updates.attachments = attachments;
      }

      const comment = await this.commentService.updateComment(commentId, updates);

      const response: ApiResponse = {
        success: true,
        data: comment,
        message: 'Comment updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async deleteComment(req: Request, res: Response): Promise<void> {
    try {
      const commentId = parseInt(req.params.id);
      const deleted_by = req.user?.id;

      if (!commentId || isNaN(commentId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid comment ID',
          errors: ['Comment ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (!deleted_by) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      await this.commentService.deleteComment(commentId, deleted_by);

      const response: ApiResponse = {
        success: true,
        message: 'Comment deleted successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getCommentThread(req: Request, res: Response): Promise<void> {
    try {
      const commentId = parseInt(req.params.id);
      const user_id = req.user?.id;

      if (!commentId || isNaN(commentId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid comment ID',
          errors: ['Comment ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const thread = await this.commentService.getCommentThread(commentId, user_id);

      const response: ApiResponse = {
        success: true,
        data: thread
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async markCommentAsRead(req: Request, res: Response): Promise<void> {
    try {
      const commentId = parseInt(req.params.id);
      const user_id = req.user?.id;

      if (!commentId || isNaN(commentId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid comment ID',
          errors: ['Comment ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (!user_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      await this.commentService.markCommentAsRead(commentId, user_id);

      const response: ApiResponse = {
        success: true,
        message: 'Comment marked as read'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const user_id = req.user?.id;
      const { entity_type, entity_id } = req.query;

      if (!user_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      let entityType: EntityType | undefined;
      let entityIdNum: number | undefined;

      if (entity_type) {
        if (!['epic', 'story', 'task', 'subtask'].includes(entity_type as string)) {
          const response: ApiResponse = {
            success: false,
            message: 'Invalid entity type',
            errors: ['entity_type must be one of: epic, story, task, subtask']
          };
          res.status(400).json(response);
          return;
        }
        entityType = entity_type as EntityType;
      }

      if (entity_id) {
        entityIdNum = parseInt(entity_id as string);
        if (isNaN(entityIdNum)) {
          const response: ApiResponse = {
            success: false,
            message: 'Invalid entity ID',
            errors: ['Entity ID must be a valid number']
          };
          res.status(400).json(response);
          return;
        }
      }

      const count = await this.commentService.getUnreadCommentCount(user_id, entityType, entityIdNum);

      const response: ApiResponse = {
        success: true,
        data: { unread_count: count }
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getRecentActivity(req: Request, res: Response): Promise<void> {
    try {
      const user_id = req.user?.id;
      const { limit, entity_type, include_internal } = req.query;

      if (!user_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      const options: any = {
        include_internal: include_internal === 'true'
      };

      if (limit) {
        const limitNum = parseInt(limit as string);
        if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 100) {
          options.limit = limitNum;
        }
      }

      if (entity_type) {
        if (!['epic', 'story', 'task', 'subtask'].includes(entity_type as string)) {
          const response: ApiResponse = {
            success: false,
            message: 'Invalid entity type',
            errors: ['entity_type must be one of: epic, story, task, subtask']
          };
          res.status(400).json(response);
          return;
        }
        options.entity_type = entity_type as EntityType;
      }

      const activity = await this.commentService.getRecentCommentActivity(user_id, options);

      const response: ApiResponse = {
        success: true,
        data: activity
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getCommentReplies(req: Request, res: Response): Promise<void> {
    try {
      const commentId = parseInt(req.params.id);
      const { include_internal } = req.query;
      const user_id = req.user?.id;

      if (!commentId || isNaN(commentId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid comment ID',
          errors: ['Comment ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      // Validate user has access to the parent comment
      const parentComment = await this.commentService.getCommentById(commentId);

      const includeInternalBool = include_internal === 'true';
      const replies = await this.commentService.getCommentReplies(commentId, includeInternalBool);

      const response: ApiResponse = {
        success: true,
        data: replies
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async processAttachments(files: Express.Multer.File[]): Promise<any[]> {
    // Process file uploads and return attachment metadata
    // This would integrate with file storage service (AWS S3, etc.)
    return files.map(file => ({
      filename: file.filename || file.originalname,
      original_filename: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
      url: `/uploads/${file.filename || file.originalname}`, // This would be the actual URL
      uploaded_at: new Date()
    }));
  }

  private handleError(res: Response, error: any): void {
    console.error('Comment Controller Error:', error);

    if (error instanceof ValidationError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: error.details ? [error.details] : [error.message]
      };
      res.status(400).json(response);
    } else if (error instanceof NotFoundError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
      };
      res.status(404).json(response);
    } else if (error instanceof ForbiddenError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
      };
      res.status(403).json(response);
    } else if (error instanceof ApplicationError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
      };
      res.status(error.statusCode).json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        errors: ['An unexpected error occurred']
      };
      res.status(500).json(response);
    }
  }
}