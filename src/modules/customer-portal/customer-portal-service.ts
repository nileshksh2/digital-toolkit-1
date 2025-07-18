import { Customer, Epic, CustomerPortalSettings, PortalVisibilitySettings, PortalBranding, Story, Task, Comment, RecentActivity } from '../../shared/types';
import { DatabaseConnection } from '../../shared/types';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/types';
import crypto from 'crypto';

export class CustomerPortalService {
  constructor(private db: DatabaseConnection) {}

  async createPortalUrl(epicId: number, customerId: number): Promise<string> {
    // Generate unique portal key
    const portalKey = this.generatePortalKey();
    
    // Update customer with portal URL key
    await this.db.query(
      'UPDATE customers SET portal_url_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [portalKey, customerId]
    );

    // Create or update portal settings
    await this.createOrUpdatePortalSettings(customerId, epicId, {
      show_phases: true,
      show_stories: true,
      show_tasks: true,
      show_subtasks: false,
      show_comments: true,
      show_attachments: true,
      show_timeline: true,
      show_team_members: false
    });

    return portalKey;
  }

  async getPortalData(portalKey: string): Promise<{
    customer: Customer;
    epic: Epic;
    visibility_settings: PortalVisibilitySettings;
    custom_branding?: PortalBranding;
    progress_summary: {
      overall_completion: number;
      phase_progress: Record<number, number>;
      timeline: Array<{
        phase_id: number;
        phase_name: string;
        status: string;
        start_date?: Date;
        end_date?: Date;
        completion_percentage: number;
      }>;
    };
    stories: Story[];
    recent_updates: RecentActivity[];
    customer_comments: Comment[];
  }> {
    // Find customer and epic by portal key
    const portalInfo = await this.db.queryFirst(`
      SELECT 
        c.*,
        e.*,
        cps.visibility_settings,
        cps.custom_branding
      FROM customers c
      JOIN epics e ON c.id = e.customer_id
      LEFT JOIN customer_portal_settings cps ON c.id = cps.customer_id AND e.id = cps.epic_id
      WHERE c.portal_url_key = ? AND c.is_active = true
    `, [portalKey]);

    if (!portalInfo) {
      throw new NotFoundError('Customer portal', portalKey);
    }

    const customer = {
      id: portalInfo.id,
      name: portalInfo.name,
      contact_email: portalInfo.contact_email,
      contact_phone: portalInfo.contact_phone,
      organization: portalInfo.organization,
      portal_url_key: portalInfo.portal_url_key,
      is_active: portalInfo.is_active,
      created_at: portalInfo.created_at,
      updated_at: portalInfo.updated_at
    };

    const epic = {
      id: portalInfo.id,
      title: portalInfo.title,
      description: portalInfo.description,
      customer_id: portalInfo.customer_id,
      template_id: portalInfo.template_id,
      current_phase_id: portalInfo.current_phase_id,
      status: portalInfo.status,
      priority: portalInfo.priority,
      start_date: portalInfo.start_date,
      end_date: portalInfo.end_date,
      estimated_hours: portalInfo.estimated_hours,
      actual_hours: portalInfo.actual_hours,
      project_manager_id: portalInfo.project_manager_id,
      created_by: portalInfo.created_by,
      created_at: portalInfo.created_at,
      updated_at: portalInfo.updated_at
    };

    const visibilitySettings = portalInfo.visibility_settings 
      ? JSON.parse(portalInfo.visibility_settings)
      : this.getDefaultVisibilitySettings();

    const customBranding = portalInfo.custom_branding 
      ? JSON.parse(portalInfo.custom_branding)
      : undefined;

    // Get progress summary
    const progressSummary = await this.getProgressSummary(epic.id, visibilitySettings);

    // Get stories (filtered by visibility)
    const stories = await this.getVisibleStories(epic.id, visibilitySettings);

    // Get recent updates
    const recentUpdates = await this.getRecentUpdates(epic.id, visibilitySettings);

    // Get customer comments
    const customerComments = await this.getCustomerComments(epic.id);

    return {
      customer,
      epic,
      visibility_settings: visibilitySettings,
      custom_branding: customBranding,
      progress_summary: progressSummary,
      stories,
      recent_updates: recentUpdates,
      customer_comments: customerComments
    };
  }

  async createOrUpdatePortalSettings(
    customerId: number, 
    epicId: number, 
    visibilitySettings: PortalVisibilitySettings,
    customBranding?: PortalBranding
  ): Promise<CustomerPortalSettings> {
    const query = `
      INSERT INTO customer_portal_settings (
        customer_id, epic_id, visibility_settings, custom_branding, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(customer_id, epic_id) DO UPDATE SET
        visibility_settings = excluded.visibility_settings,
        custom_branding = excluded.custom_branding,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.db.query(query, [
      customerId,
      epicId,
      JSON.stringify(visibilitySettings),
      customBranding ? JSON.stringify(customBranding) : null
    ]);

    return await this.getPortalSettings(customerId, epicId);
  }

  async getPortalSettings(customerId: number, epicId: number): Promise<CustomerPortalSettings> {
    const settings = await this.db.queryFirst(`
      SELECT 
        cps.*,
        c.name as customer_name,
        e.title as epic_title
      FROM customer_portal_settings cps
      JOIN customers c ON cps.customer_id = c.id
      JOIN epics e ON cps.epic_id = e.id
      WHERE cps.customer_id = ? AND cps.epic_id = ?
    `, [customerId, epicId]);

    if (!settings) {
      throw new NotFoundError(`Portal settings for customer ${customerId} and epic ${epicId}`);
    }

    return {
      ...settings,
      visibility_settings: JSON.parse(settings.visibility_settings),
      custom_branding: settings.custom_branding ? JSON.parse(settings.custom_branding) : null
    };
  }

  async updatePortalBranding(customerId: number, epicId: number, branding: PortalBranding): Promise<CustomerPortalSettings> {
    await this.db.query(`
      UPDATE customer_portal_settings 
      SET custom_branding = ?, updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = ? AND epic_id = ?
    `, [JSON.stringify(branding), customerId, epicId]);

    return await this.getPortalSettings(customerId, epicId);
  }

  async updateVisibilitySettings(customerId: number, epicId: number, settings: PortalVisibilitySettings): Promise<CustomerPortalSettings> {
    await this.db.query(`
      UPDATE customer_portal_settings 
      SET visibility_settings = ?, updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = ? AND epic_id = ?
    `, [JSON.stringify(settings), customerId, epicId]);

    return await this.getPortalSettings(customerId, epicId);
  }

  async submitCustomerComment(data: {
    portal_key: string;
    entity_type: 'epic' | 'story' | 'task';
    entity_id: number;
    content: string;
    attachments?: Express.Multer.File[];
    author_email: string;
  }): Promise<Comment> {
    // Verify portal access
    const portalData = await this.getPortalData(data.portal_key);
    
    // Verify entity belongs to this epic
    await this.verifyEntityAccess(data.entity_type, data.entity_id, portalData.epic.id);

    // Find or create customer user
    let customerUser = await this.db.queryFirst(
      'SELECT id FROM users WHERE email = ? AND role = "customer"',
      [data.author_email]
    );

    if (!customerUser) {
      // Create temporary customer user
      customerUser = await this.createTemporaryCustomerUser(data.author_email, portalData.customer.name);
    }

    // Create comment
    const commentQuery = `
      INSERT INTO comments (
        entity_type, entity_id, content, is_internal, author_id, 
        attachments, created_at, updated_at
      ) VALUES (?, ?, ?, false, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const attachmentData = data.attachments ? await this.processAttachments(data.attachments) : null;

    const result = await this.db.query(commentQuery, [
      data.entity_type,
      data.entity_id,
      data.content,
      customerUser.id,
      attachmentData ? JSON.stringify(attachmentData) : null
    ]);

    return await this.getCommentById(result.insertId);
  }

  async getCustomerComments(epicId: number): Promise<Comment[]> {
    const query = `
      SELECT 
        c.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.is_internal = false 
        AND (
          (c.entity_type = 'epic' AND c.entity_id = ?) OR
          (c.entity_type = 'story' AND c.entity_id IN (
            SELECT id FROM stories WHERE epic_id = ?
          )) OR
          (c.entity_type = 'task' AND c.entity_id IN (
            SELECT t.id FROM tasks t 
            JOIN stories s ON t.story_id = s.id 
            WHERE s.epic_id = ?
          ))
        )
      ORDER BY c.created_at DESC
      LIMIT 50
    `;

    const comments = await this.db.query(query, [epicId, epicId, epicId]);

    return comments.map(comment => ({
      ...comment,
      attachments: comment.attachments ? JSON.parse(comment.attachments) : null
    }));
  }

  async generatePortalReport(portalKey: string, format: 'pdf' | 'excel' = 'pdf'): Promise<Buffer> {
    const portalData = await this.getPortalData(portalKey);
    
    // This would integrate with a PDF/Excel generation library
    // For now, returning a placeholder
    const reportData = {
      customer: portalData.customer,
      epic: portalData.epic,
      progress: portalData.progress_summary,
      generated_at: new Date()
    };

    if (format === 'pdf') {
      return this.generatePDFReport(reportData);
    } else {
      return this.generateExcelReport(reportData);
    }
  }

  // Private helper methods
  private generatePortalKey(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private getDefaultVisibilitySettings(): PortalVisibilitySettings {
    return {
      show_phases: true,
      show_stories: true,
      show_tasks: true,
      show_subtasks: false,
      show_comments: true,
      show_attachments: true,
      show_timeline: true,
      show_team_members: false
    };
  }

  private async getProgressSummary(epicId: number, visibilitySettings: PortalVisibilitySettings) {
    // Get phase progress
    const phaseProgress = await this.db.query(`
      SELECT 
        ep.phase_id,
        p.name as phase_name,
        ep.status,
        ep.start_date,
        ep.end_date,
        ep.completion_percentage
      FROM epic_phases ep
      JOIN phases p ON ep.phase_id = p.id
      WHERE ep.epic_id = ?
      ORDER BY p.sequence_order
    `, [epicId]);

    // Calculate overall completion
    const totalCompletion = phaseProgress.reduce((sum, phase) => sum + phase.completion_percentage, 0);
    const overallCompletion = Math.round(totalCompletion / phaseProgress.length);

    // Build phase progress record
    const phaseProgressRecord: Record<number, number> = {};
    phaseProgress.forEach(phase => {
      phaseProgressRecord[phase.phase_id] = phase.completion_percentage;
    });

    return {
      overall_completion: overallCompletion,
      phase_progress: phaseProgressRecord,
      timeline: phaseProgress
    };
  }

  private async getVisibleStories(epicId: number, visibilitySettings: PortalVisibilitySettings): Promise<Story[]> {
    if (!visibilitySettings.show_stories) {
      return [];
    }

    let query = `
      SELECT 
        s.*,
        p.name as phase_name
      FROM stories s
      JOIN phases p ON s.phase_id = p.id
      WHERE s.epic_id = ?
    `;

    const params = [epicId];

    // Filter by allowed phases if specified
    if (visibilitySettings.allowed_phases && visibilitySettings.allowed_phases.length > 0) {
      const placeholders = visibilitySettings.allowed_phases.map(() => '?').join(',');
      query += ` AND s.phase_id IN (${placeholders})`;
      params.push(...visibilitySettings.allowed_phases);
    }

    query += ' ORDER BY s.sequence_order ASC, s.created_at ASC';

    const stories = await this.db.query(query, params);

    // Include tasks if visible
    if (visibilitySettings.show_tasks) {
      for (const story of stories) {
        story.tasks = await this.getVisibleTasks(story.id, visibilitySettings);
      }
    }

    return stories;
  }

  private async getVisibleTasks(storyId: number, visibilitySettings: PortalVisibilitySettings): Promise<Task[]> {
    if (!visibilitySettings.show_tasks) {
      return [];
    }

    const query = `
      SELECT t.*
      FROM tasks t
      WHERE t.story_id = ?
      ORDER BY t.sequence_order ASC, t.created_at ASC
    `;

    const tasks = await this.db.query(query, [storyId]);

    // Include subtasks if visible
    if (visibilitySettings.show_subtasks) {
      for (const task of tasks) {
        task.subtasks = await this.db.query(`
          SELECT st.*
          FROM subtasks st
          WHERE st.task_id = ?
          ORDER BY st.sequence_order ASC, st.created_at ASC
        `, [task.id]);
      }
    }

    return tasks;
  }

  private async getRecentUpdates(epicId: number, visibilitySettings: PortalVisibilitySettings): Promise<RecentActivity[]> {
    // Get recent activities based on audit logs
    let query = `
      SELECT 
        al.action,
        al.entity_type,
        al.entity_id,
        al.created_at,
        u.first_name,
        u.last_name,
        CASE 
          WHEN al.entity_type = 'epic' THEN e.title
          WHEN al.entity_type = 'story' THEN s.title  
          WHEN al.entity_type = 'task' THEN t.title
          ELSE 'Unknown'
        END as entity_title
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN epics e ON al.entity_type = 'epic' AND al.entity_id = e.id
      LEFT JOIN stories s ON al.entity_type = 'story' AND al.entity_id = s.id
      LEFT JOIN tasks t ON al.entity_type = 'task' AND al.entity_id = t.id
      WHERE (
        (al.entity_type = 'epic' AND al.entity_id = ?) OR
        (al.entity_type = 'story' AND al.entity_id IN (
          SELECT id FROM stories WHERE epic_id = ?
        )) OR
        (al.entity_type = 'task' AND al.entity_id IN (
          SELECT t.id FROM tasks t 
          JOIN stories s ON t.story_id = s.id 
          WHERE s.epic_id = ?
        ))
      )
      AND al.action NOT LIKE '%_LOGIN%'
      AND al.action NOT LIKE '%_LOGOUT%'
      ORDER BY al.created_at DESC
      LIMIT 20
    `;

    const activities = await this.db.query(query, [epicId, epicId, epicId]);

    return activities.map(activity => ({
      id: activity.id,
      type: activity.action,
      description: this.formatActivityDescription(activity),
      entity_type: activity.entity_type,
      entity_id: activity.entity_id,
      entity_title: activity.entity_title,
      user: {
        id: activity.user_id,
        first_name: activity.first_name,
        last_name: activity.last_name
      },
      created_at: activity.created_at
    }));
  }

  private formatActivityDescription(activity: any): string {
    const userDisplay = activity.first_name && activity.last_name 
      ? `${activity.first_name} ${activity.last_name}`
      : 'System';

    const actionMap: Record<string, string> = {
      'EPIC_CREATED': 'created the project',
      'EPIC_UPDATED': 'updated the project',
      'STORY_CREATED': 'created a story',
      'STORY_UPDATED': 'updated a story',
      'TASK_CREATED': 'created a task',
      'TASK_UPDATED': 'updated a task',
      'PHASE_TRANSITION': 'moved to next phase',
      'COMMENT_ADDED': 'added a comment'
    };

    const actionText = actionMap[activity.action] || 'performed an action';
    const entityText = activity.entity_title || `${activity.entity_type} #${activity.entity_id}`;

    return `${userDisplay} ${actionText} on ${entityText}`;
  }

  private async verifyEntityAccess(entityType: string, entityId: number, epicId: number): Promise<void> {
    let query = '';
    
    switch (entityType) {
      case 'epic':
        if (entityId !== epicId) {
          throw new ForbiddenError('Entity does not belong to this project');
        }
        return;
      case 'story':
        query = 'SELECT epic_id FROM stories WHERE id = ?';
        break;
      case 'task':
        query = `
          SELECT s.epic_id 
          FROM tasks t 
          JOIN stories s ON t.story_id = s.id 
          WHERE t.id = ?
        `;
        break;
      default:
        throw new ValidationError('Invalid entity type');
    }

    const result = await this.db.queryFirst(query, [entityId]);
    
    if (!result || result.epic_id !== epicId) {
      throw new ForbiddenError('Entity does not belong to this project');
    }
  }

  private async createTemporaryCustomerUser(email: string, customerName: string): Promise<{ id: number }> {
    // Create a temporary customer user for comment attribution
    const query = `
      INSERT INTO users (
        username, email, password_hash, first_name, last_name, role, 
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'customer', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const username = email.split('@')[0];
    const hashedPassword = ''; // No password for portal-only users

    const result = await this.db.query(query, [
      username,
      email,
      hashedPassword,
      customerName || 'Customer',
      'User'
    ]);

    return { id: result.insertId };
  }

  private async processAttachments(files: Express.Multer.File[]): Promise<any[]> {
    // Process file uploads and return attachment metadata
    // This would integrate with file storage service
    return files.map(file => ({
      filename: file.filename,
      original_filename: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype
    }));
  }

  private async getCommentById(id: number): Promise<Comment> {
    const query = `
      SELECT 
        c.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email
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
      attachments: comment.attachments ? JSON.parse(comment.attachments) : null
    };
  }

  private async generatePDFReport(data: any): Promise<Buffer> {
    // Placeholder for PDF generation
    // Would use a library like puppeteer, jsPDF, or PDFKit
    const reportContent = JSON.stringify(data, null, 2);
    return Buffer.from(reportContent, 'utf-8');
  }

  private async generateExcelReport(data: any): Promise<Buffer> {
    // Placeholder for Excel generation
    // Would use a library like ExcelJS
    const reportContent = JSON.stringify(data, null, 2);
    return Buffer.from(reportContent, 'utf-8');
  }
}