import { Comment, CommentThread, User, EntityType, CommentType, CommentNotification } from '../../shared/types';
import { DatabaseConnection } from '../../shared/types';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/types';

export class CommentService {
  constructor(private db: DatabaseConnection) {}

  async createComment(data: {
    entity_type: EntityType;
    entity_id: number;
    content: string;
    is_internal: boolean;
    author_id: number;
    parent_comment_id?: number;
    attachments?: any[];
    mentions?: number[];
  }): Promise<Comment> {
    const { entity_type, entity_id, content, is_internal, author_id, parent_comment_id, attachments, mentions } = data;

    // Validate entity exists
    await this.validateEntityExists(entity_type, entity_id);

    // Validate parent comment if replying
    if (parent_comment_id) {
      const parentComment = await this.getCommentById(parent_comment_id);
      if (parentComment.entity_type !== entity_type || parentComment.entity_id !== entity_id) {
        throw new ValidationError('Parent comment does not belong to the same entity');
      }
    }

    // Validate author permissions
    await this.validateCommentPermissions(author_id, entity_type, entity_id, is_internal);

    const query = `
      INSERT INTO comments (
        entity_type, entity_id, content, is_internal, author_id, 
        parent_comment_id, attachments, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const result = await this.db.query(query, [
      entity_type,
      entity_id,
      content,
      is_internal,
      author_id,
      parent_comment_id || null,
      attachments ? JSON.stringify(attachments) : null
    ]);

    const comment = await this.getCommentById(result.insertId);

    // Handle mentions
    if (mentions && mentions.length > 0) {
      await this.processMentions(comment.id, mentions);
    }

    // Create notifications
    await this.createCommentNotifications(comment);

    return comment;
  }

  async getCommentById(id: number): Promise<Comment> {
    const query = `
      SELECT 
        c.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email,
        u.avatar_url as author_avatar,
        u.role as author_role,
        (SELECT COUNT(*) FROM comments WHERE parent_comment_id = c.id) as reply_count
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `;

    const comment = await this.db.queryFirst(query, [id]);

    if (!comment) {
      throw new NotFoundError('Comment', id);
    }

    return {
      ...comment,
      attachments: comment.attachments ? JSON.parse(comment.attachments) : null,
      author: {
        id: comment.author_id,
        first_name: comment.author_first_name,
        last_name: comment.author_last_name,
        email: comment.author_email,
        avatar_url: comment.author_avatar,
        role: comment.author_role
      }
    };
  }

  async getCommentsByEntity(
    entityType: EntityType,
    entityId: number,
    options: {
      include_internal?: boolean;
      user_id?: number;
      limit?: number;
      offset?: number;
      sort?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    comments: Comment[];
    total: number;
    internal_count: number;
    customer_count: number;
  }> {
    const { include_internal = true, user_id, limit, offset, sort = 'desc' } = options;

    // Validate user permissions for internal comments
    if (include_internal && user_id) {
      await this.validateUserCanViewInternal(user_id, entityType, entityId);
    }

    let whereClause = 'c.entity_type = ? AND c.entity_id = ? AND c.parent_comment_id IS NULL';
    const queryParams = [entityType, entityId];

    if (!include_internal) {
      whereClause += ' AND c.is_internal = false';
    }

    const query = `
      SELECT 
        c.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email,
        u.avatar_url as author_avatar,
        u.role as author_role,
        (SELECT COUNT(*) FROM comments WHERE parent_comment_id = c.id) as reply_count
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE ${whereClause}
      ORDER BY c.created_at ${sort.toUpperCase()}
      ${limit ? `LIMIT ${limit}` : ''}
      ${offset ? `OFFSET ${offset}` : ''}
    `;

    const comments = await this.db.query(query, queryParams);

    // Get reply threads for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await this.getCommentReplies(comment.id, include_internal);
        return {
          ...comment,
          attachments: comment.attachments ? JSON.parse(comment.attachments) : null,
          author: {
            id: comment.author_id,
            first_name: comment.author_first_name,
            last_name: comment.author_last_name,
            email: comment.author_email,
            avatar_url: comment.author_avatar,
            role: comment.author_role
          },
          replies
        };
      })
    );

    // Get counts
    const totalQuery = `
      SELECT COUNT(*) as total FROM comments 
      WHERE entity_type = ? AND entity_id = ? AND parent_comment_id IS NULL
    `;
    const totalResult = await this.db.queryFirst(totalQuery, [entityType, entityId]);

    const internalQuery = `
      SELECT COUNT(*) as count FROM comments 
      WHERE entity_type = ? AND entity_id = ? AND is_internal = true
    `;
    const internalResult = await this.db.queryFirst(internalQuery, [entityType, entityId]);

    const customerQuery = `
      SELECT COUNT(*) as count FROM comments 
      WHERE entity_type = ? AND entity_id = ? AND is_internal = false
    `;
    const customerResult = await this.db.queryFirst(customerQuery, [entityType, entityId]);

    return {
      comments: commentsWithReplies,
      total: totalResult.total,
      internal_count: internalResult.count,
      customer_count: customerResult.count
    };
  }

  async getCommentReplies(parentCommentId: number, includeInternal: boolean = true): Promise<Comment[]> {
    let query = `
      SELECT 
        c.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email,
        u.avatar_url as author_avatar,
        u.role as author_role
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.parent_comment_id = ?
    `;

    if (!includeInternal) {
      query += ' AND c.is_internal = false';
    }

    query += ' ORDER BY c.created_at ASC';

    const replies = await this.db.query(query, [parentCommentId]);

    return replies.map(reply => ({
      ...reply,
      attachments: reply.attachments ? JSON.parse(reply.attachments) : null,
      author: {
        id: reply.author_id,
        first_name: reply.author_first_name,
        last_name: reply.author_last_name,
        email: reply.author_email,
        avatar_url: reply.author_avatar,
        role: reply.author_role
      }
    }));
  }

  async updateComment(id: number, updates: {
    content?: string;
    attachments?: any[];
    updated_by: number;
  }): Promise<Comment> {
    const existingComment = await this.getCommentById(id);
    const { content, attachments, updated_by } = updates;

    // Validate user can edit this comment
    await this.validateCommentEditPermissions(updated_by, existingComment);

    const updateFields = [];
    const updateValues = [];

    if (content !== undefined) {
      updateFields.push('content = ?');
      updateValues.push(content);
    }

    if (attachments !== undefined) {
      updateFields.push('attachments = ?');
      updateValues.push(attachments ? JSON.stringify(attachments) : null);
    }

    if (updateFields.length === 0) {
      return existingComment;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateFields.push('is_edited = true');
    updateValues.push(id);

    const query = `UPDATE comments SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.query(query, updateValues);

    return await this.getCommentById(id);
  }

  async deleteComment(id: number, deletedBy: number): Promise<void> {
    const comment = await this.getCommentById(id);

    // Validate user can delete this comment
    await this.validateCommentDeletePermissions(deletedBy, comment);

    // Soft delete the comment and its replies
    await this.db.query(`
      UPDATE comments 
      SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
      WHERE id = ? OR parent_comment_id = ?
    `, [deletedBy, id, id]);
  }

  async getCommentThread(commentId: number, userId?: number): Promise<CommentThread> {
    const comment = await this.getCommentById(commentId);
    
    // If this is a reply, get the parent comment
    const rootComment = comment.parent_comment_id 
      ? await this.getCommentById(comment.parent_comment_id)
      : comment;

    // Get all replies to the root comment
    const includeInternal = userId ? await this.canUserViewInternal(userId, rootComment.entity_type, rootComment.entity_id) : false;
    const replies = await this.getCommentReplies(rootComment.id, includeInternal);

    return {
      root_comment: rootComment,
      replies,
      total_replies: replies.length
    };
  }

  async markCommentAsRead(commentId: number, userId: number): Promise<void> {
    const query = `
      INSERT INTO comment_read_status (comment_id, user_id, read_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (comment_id, user_id) DO UPDATE SET read_at = CURRENT_TIMESTAMP
    `;

    await this.db.query(query, [commentId, userId]);
  }

  async getUnreadCommentCount(userId: number, entityType?: EntityType, entityId?: number): Promise<number> {
    let query = `
      SELECT COUNT(DISTINCT c.id) as count
      FROM comments c
      LEFT JOIN comment_read_status crs ON c.id = crs.comment_id AND crs.user_id = ?
      WHERE crs.comment_id IS NULL AND c.author_id != ?
    `;

    const queryParams = [userId, userId];

    if (entityType && entityId) {
      query += ' AND c.entity_type = ? AND c.entity_id = ?';
      queryParams.push(entityType, entityId);
    }

    // Filter by user's access permissions
    if (!await this.canUserViewInternal(userId, entityType, entityId)) {
      query += ' AND c.is_internal = false';
    }

    const result = await this.db.queryFirst(query, queryParams);
    return result.count;
  }

  async createCommentNotifications(comment: Comment): Promise<void> {
    // Get users who should be notified
    const notificationTargets = await this.getNotificationTargets(comment);

    const notifications = notificationTargets.map(userId => ({
      user_id: userId,
      comment_id: comment.id,
      type: comment.is_internal ? CommentType.INTERNAL : CommentType.CUSTOMER,
      is_read: false,
      created_at: new Date()
    }));

    if (notifications.length > 0) {
      const query = `
        INSERT INTO comment_notifications (user_id, comment_id, type, is_read, created_at)
        VALUES ${notifications.map(() => '(?, ?, ?, ?, ?)').join(', ')}
      `;

      const values = notifications.flatMap(n => [n.user_id, n.comment_id, n.type, n.is_read, n.created_at]);
      await this.db.query(query, values);
    }
  }

  async getRecentCommentActivity(
    userId: number,
    options: {
      limit?: number;
      entity_type?: EntityType;
      include_internal?: boolean;
    } = {}
  ): Promise<Comment[]> {
    const { limit = 20, entity_type, include_internal = true } = options;

    let query = `
      SELECT 
        c.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email,
        u.avatar_url as author_avatar,
        u.role as author_role,
        CASE 
          WHEN c.entity_type = 'epic' THEN e.title
          WHEN c.entity_type = 'story' THEN s.title
          WHEN c.entity_type = 'task' THEN t.title
          ELSE 'Unknown'
        END as entity_title
      FROM comments c
      JOIN users u ON c.author_id = u.id
      LEFT JOIN epics e ON c.entity_type = 'epic' AND c.entity_id = e.id
      LEFT JOIN stories s ON c.entity_type = 'story' AND c.entity_id = s.id
      LEFT JOIN tasks t ON c.entity_type = 'task' AND c.entity_id = t.id
      WHERE c.is_deleted = false
    `;

    const queryParams = [];

    if (entity_type) {
      query += ' AND c.entity_type = ?';
      queryParams.push(entity_type);
    }

    if (!include_internal) {
      query += ' AND c.is_internal = false';
    }

    // Filter by user's project access
    query += `
      AND (
        c.entity_type = 'epic' AND e.id IN (
          SELECT epic_id FROM epic_team_members WHERE user_id = ?
        ) OR
        c.entity_type = 'story' AND c.entity_id IN (
          SELECT s.id FROM stories s 
          JOIN epic_team_members etm ON s.epic_id = etm.epic_id 
          WHERE etm.user_id = ?
        ) OR
        c.entity_type = 'task' AND c.entity_id IN (
          SELECT t.id FROM tasks t 
          JOIN stories s ON t.story_id = s.id
          JOIN epic_team_members etm ON s.epic_id = etm.epic_id 
          WHERE etm.user_id = ?
        )
      )
    `;

    queryParams.push(userId, userId, userId);

    query += ` ORDER BY c.created_at DESC LIMIT ${limit}`;

    const comments = await this.db.query(query, queryParams);

    return comments.map(comment => ({
      ...comment,
      attachments: comment.attachments ? JSON.parse(comment.attachments) : null,
      author: {
        id: comment.author_id,
        first_name: comment.author_first_name,
        last_name: comment.author_last_name,
        email: comment.author_email,
        avatar_url: comment.author_avatar,
        role: comment.author_role
      }
    }));
  }

  // Private helper methods
  private async validateEntityExists(entityType: EntityType, entityId: number): Promise<void> {
    let query = '';
    
    switch (entityType) {
      case 'epic':
        query = 'SELECT id FROM epics WHERE id = ?';
        break;
      case 'story':
        query = 'SELECT id FROM stories WHERE id = ?';
        break;
      case 'task':
        query = 'SELECT id FROM tasks WHERE id = ?';
        break;
      case 'subtask':
        query = 'SELECT id FROM subtasks WHERE id = ?';
        break;
      default:
        throw new ValidationError('Invalid entity type');
    }

    const entity = await this.db.queryFirst(query, [entityId]);
    if (!entity) {
      throw new NotFoundError(`${entityType} with ID ${entityId}`);
    }
  }

  private async validateCommentPermissions(
    userId: number,
    entityType: EntityType,
    entityId: number,
    isInternal: boolean
  ): Promise<void> {
    // Check if user has access to the entity
    const hasAccess = await this.canUserAccessEntity(userId, entityType, entityId);
    if (!hasAccess) {
      throw new ForbiddenError('User does not have access to this entity');
    }

    // Check if user can create internal comments
    if (isInternal && !await this.canUserCreateInternal(userId)) {
      throw new ForbiddenError('User cannot create internal comments');
    }
  }

  private async validateCommentEditPermissions(userId: number, comment: Comment): Promise<void> {
    // Users can only edit their own comments, or admins can edit any comment
    const user = await this.db.queryFirst('SELECT role FROM users WHERE id = ?', [userId]);
    
    if (comment.author_id !== userId && !['system_admin', 'project_manager'].includes(user.role)) {
      throw new ForbiddenError('You can only edit your own comments');
    }
  }

  private async validateCommentDeletePermissions(userId: number, comment: Comment): Promise<void> {
    // Users can delete their own comments, or admins can delete any comment
    const user = await this.db.queryFirst('SELECT role FROM users WHERE id = ?', [userId]);
    
    if (comment.author_id !== userId && !['system_admin', 'project_manager'].includes(user.role)) {
      throw new ForbiddenError('You can only delete your own comments');
    }
  }

  private async canUserAccessEntity(userId: number, entityType: EntityType, entityId: number): Promise<boolean> {
    let query = '';
    
    switch (entityType) {
      case 'epic':
        query = `
          SELECT COUNT(*) as count FROM epic_team_members 
          WHERE epic_id = ? AND user_id = ?
        `;
        break;
      case 'story':
        query = `
          SELECT COUNT(*) as count FROM epic_team_members etm
          JOIN stories s ON etm.epic_id = s.epic_id
          WHERE s.id = ? AND etm.user_id = ?
        `;
        break;
      case 'task':
        query = `
          SELECT COUNT(*) as count FROM epic_team_members etm
          JOIN stories s ON etm.epic_id = s.epic_id
          JOIN tasks t ON s.id = t.story_id
          WHERE t.id = ? AND etm.user_id = ?
        `;
        break;
      case 'subtask':
        query = `
          SELECT COUNT(*) as count FROM epic_team_members etm
          JOIN stories s ON etm.epic_id = s.epic_id
          JOIN tasks t ON s.id = t.story_id
          JOIN subtasks st ON t.id = st.task_id
          WHERE st.id = ? AND etm.user_id = ?
        `;
        break;
      default:
        return false;
    }

    const result = await this.db.queryFirst(query, [entityId, userId]);
    return result.count > 0;
  }

  private async canUserViewInternal(userId: number, entityType?: EntityType, entityId?: number): Promise<boolean> {
    const user = await this.db.queryFirst('SELECT role FROM users WHERE id = ?', [userId]);
    
    // Customer users cannot view internal comments
    if (user.role === 'customer') {
      return false;
    }

    // System admins and project managers can view all internal comments
    if (['system_admin', 'project_manager'].includes(user.role)) {
      return true;
    }

    // Team members can view internal comments for their assigned projects
    if (entityType && entityId) {
      return await this.canUserAccessEntity(userId, entityType, entityId);
    }

    return false;
  }

  private async validateUserCanViewInternal(userId: number, entityType: EntityType, entityId: number): Promise<void> {
    const canView = await this.canUserViewInternal(userId, entityType, entityId);
    if (!canView) {
      throw new ForbiddenError('User cannot view internal comments');
    }
  }

  private async canUserCreateInternal(userId: number): Promise<boolean> {
    const user = await this.db.queryFirst('SELECT role FROM users WHERE id = ?', [userId]);
    return user.role !== 'customer';
  }

  private async getNotificationTargets(comment: Comment): Promise<number[]> {
    const targets = new Set<number>();

    // Get all team members for the entity
    let query = '';
    
    switch (comment.entity_type) {
      case 'epic':
        query = 'SELECT user_id FROM epic_team_members WHERE epic_id = ?';
        break;
      case 'story':
        query = `
          SELECT etm.user_id FROM epic_team_members etm
          JOIN stories s ON etm.epic_id = s.epic_id
          WHERE s.id = ?
        `;
        break;
      case 'task':
        query = `
          SELECT etm.user_id FROM epic_team_members etm
          JOIN stories s ON etm.epic_id = s.epic_id
          JOIN tasks t ON s.id = t.story_id
          WHERE t.id = ?
        `;
        break;
      default:
        return [];
    }

    const teamMembers = await this.db.query(query, [comment.entity_id]);
    teamMembers.forEach(member => targets.add(member.user_id));

    // Remove the comment author from notifications
    targets.delete(comment.author_id);

    // For customer comments, notify all internal team members
    // For internal comments, only notify internal team members
    if (!comment.is_internal) {
      // This is a customer comment - notify all team members
      return Array.from(targets);
    } else {
      // This is an internal comment - only notify non-customer users
      const internalUsers = await this.db.query(`
        SELECT id FROM users 
        WHERE id IN (${Array.from(targets).map(() => '?').join(',')}) 
        AND role != 'customer'
      `, Array.from(targets));
      
      return internalUsers.map(user => user.id);
    }
  }

  private async processMentions(commentId: number, mentionedUserIds: number[]): Promise<void> {
    if (mentionedUserIds.length === 0) return;

    const query = `
      INSERT INTO comment_mentions (comment_id, mentioned_user_id, created_at)
      VALUES ${mentionedUserIds.map(() => '(?, ?, CURRENT_TIMESTAMP)').join(', ')}
    `;

    const values = mentionedUserIds.flatMap(userId => [commentId, userId]);
    await this.db.query(query, values);
  }
}