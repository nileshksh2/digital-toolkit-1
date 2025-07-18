import { AuditLog, EntityType } from '../../shared/types';
import { DatabaseConnection } from '../../shared/types';
import { NotFoundError, ValidationError } from '../../shared/types';

export class AuditService {
  constructor(private db: DatabaseConnection) {}

  async logAction(data: {
    user_id?: number;
    action: string;
    entity_type: EntityType;
    entity_id: number;
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    const {
      user_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      ip_address,
      user_agent
    } = data;

    const query = `
      INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, old_values, new_values,
        ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const result = await this.db.query(query, [
      user_id,
      action,
      entity_type,
      entity_id,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      ip_address,
      user_agent
    ]);

    return await this.getAuditLogById(result.insertId);
  }

  async getAuditLogById(id: number): Promise<AuditLog> {
    const query = `
      SELECT 
        al.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.username as username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ?
    `;

    const log = await this.db.queryFirst(query, [id]);

    if (!log) {
      throw new NotFoundError('Audit log', id);
    }

    // Parse JSON fields
    if (log.old_values) {
      log.old_values = JSON.parse(log.old_values);
    }
    if (log.new_values) {
      log.new_values = JSON.parse(log.new_values);
    }

    return log;
  }

  async getAuditLogs(filters?: {
    user_id?: number;
    entity_type?: EntityType;
    entity_id?: number;
    action?: string;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    let query = `
      SELECT 
        al.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.username as username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      WHERE 1=1
    `;

    const queryParams = [];
    const conditions = [];

    if (filters?.user_id) {
      conditions.push('al.user_id = ?');
      queryParams.push(filters.user_id);
    }

    if (filters?.entity_type) {
      conditions.push('al.entity_type = ?');
      queryParams.push(filters.entity_type);
    }

    if (filters?.entity_id) {
      conditions.push('al.entity_id = ?');
      queryParams.push(filters.entity_id);
    }

    if (filters?.action) {
      conditions.push('al.action = ?');
      queryParams.push(filters.action);
    }

    if (filters?.start_date) {
      conditions.push('al.created_at >= ?');
      queryParams.push(filters.start_date.toISOString());
    }

    if (filters?.end_date) {
      conditions.push('al.created_at <= ?');
      queryParams.push(filters.end_date.toISOString());
    }

    if (conditions.length > 0) {
      const conditionString = ' AND ' + conditions.join(' AND ');
      query += conditionString;
      countQuery += conditionString;
    }

    // Get total count
    const countResult = await this.db.queryFirst(countQuery, queryParams);
    const total = countResult.total;

    // Add ordering and pagination
    query += ' ORDER BY al.created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      queryParams.push(filters.limit);
    }

    if (filters?.offset) {
      query += ' OFFSET ?';
      queryParams.push(filters.offset);
    }

    const logs = await this.db.query(query, queryParams);

    // Parse JSON fields
    const parsedLogs = logs.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null
    }));

    return {
      logs: parsedLogs,
      total
    };
  }

  async getEntityAuditHistory(entityType: EntityType, entityId: number): Promise<AuditLog[]> {
    const query = `
      SELECT 
        al.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.username as username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = ? AND al.entity_id = ?
      ORDER BY al.created_at ASC
    `;

    const logs = await this.db.query(query, [entityType, entityId]);

    return logs.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null
    }));
  }

  async getUserActivity(userId: number, filters?: {
    start_date?: Date;
    end_date?: Date;
    limit?: number;
  }): Promise<AuditLog[]> {
    let query = `
      SELECT 
        al.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.username as username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id = ?
    `;

    const queryParams = [userId];

    if (filters?.start_date) {
      query += ' AND al.created_at >= ?';
      queryParams.push(filters.start_date.toISOString());
    }

    if (filters?.end_date) {
      query += ' AND al.created_at <= ?';
      queryParams.push(filters.end_date.toISOString());
    }

    query += ' ORDER BY al.created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      queryParams.push(filters.limit);
    }

    const logs = await this.db.query(query, queryParams);

    return logs.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null
    }));
  }

  // Audit Action Helpers
  async logEpicCreated(data: {
    user_id: number;
    epic_id: number;
    epic_data: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'EPIC_CREATED',
      entity_type: EntityType.EPIC,
      entity_id: data.epic_id,
      new_values: data.epic_data,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logEpicUpdated(data: {
    user_id: number;
    epic_id: number;
    old_data: any;
    new_data: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'EPIC_UPDATED',
      entity_type: EntityType.EPIC,
      entity_id: data.epic_id,
      old_values: data.old_data,
      new_values: data.new_data,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logEpicDeleted(data: {
    user_id: number;
    epic_id: number;
    epic_data: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'EPIC_DELETED',
      entity_type: EntityType.EPIC,
      entity_id: data.epic_id,
      old_values: data.epic_data,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logStoryCreated(data: {
    user_id: number;
    story_id: number;
    story_data: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'STORY_CREATED',
      entity_type: EntityType.STORY,
      entity_id: data.story_id,
      new_values: data.story_data,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logStoryUpdated(data: {
    user_id: number;
    story_id: number;
    old_data: any;
    new_data: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'STORY_UPDATED',
      entity_type: EntityType.STORY,
      entity_id: data.story_id,
      old_values: data.old_data,
      new_values: data.new_data,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logTaskCreated(data: {
    user_id: number;
    task_id: number;
    task_data: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'TASK_CREATED',
      entity_type: EntityType.TASK,
      entity_id: data.task_id,
      new_values: data.task_data,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logTaskUpdated(data: {
    user_id: number;
    task_id: number;
    old_data: any;
    new_data: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'TASK_UPDATED',
      entity_type: EntityType.TASK,
      entity_id: data.task_id,
      old_values: data.old_data,
      new_values: data.new_data,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logSubtaskCreated(data: {
    user_id: number;
    subtask_id: number;
    subtask_data: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'SUBTASK_CREATED',
      entity_type: EntityType.SUBTASK,
      entity_id: data.subtask_id,
      new_values: data.subtask_data,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logSubtaskUpdated(data: {
    user_id: number;
    subtask_id: number;
    old_data: any;
    new_data: any;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'SUBTASK_UPDATED',
      entity_type: EntityType.SUBTASK,
      entity_id: data.subtask_id,
      old_values: data.old_data,
      new_values: data.new_data,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logUserLogin(data: {
    user_id: number;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'USER_LOGIN',
      entity_type: EntityType.USER,
      entity_id: data.user_id,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logUserLogout(data: {
    user_id: number;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'USER_LOGOUT',
      entity_type: EntityType.USER,
      entity_id: data.user_id,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logPasswordChange(data: {
    user_id: number;
    target_user_id: number;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'PASSWORD_CHANGED',
      entity_type: EntityType.USER,
      entity_id: data.target_user_id,
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logPhaseTransition(data: {
    user_id: number;
    epic_id: number;
    from_phase: string;
    to_phase: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'PHASE_TRANSITION',
      entity_type: EntityType.EPIC,
      entity_id: data.epic_id,
      old_values: { phase: data.from_phase },
      new_values: { phase: data.to_phase },
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logPermissionGranted(data: {
    user_id: number;
    target_user_id: number;
    epic_id: number;
    permission_level: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'PERMISSION_GRANTED',
      entity_type: EntityType.USER,
      entity_id: data.target_user_id,
      new_values: {
        epic_id: data.epic_id,
        permission_level: data.permission_level
      },
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  async logPermissionRevoked(data: {
    user_id: number;
    target_user_id: number;
    epic_id: number;
    ip_address?: string;
    user_agent?: string;
  }): Promise<AuditLog> {
    return await this.logAction({
      user_id: data.user_id,
      action: 'PERMISSION_REVOKED',
      entity_type: EntityType.USER,
      entity_id: data.target_user_id,
      old_values: { epic_id: data.epic_id },
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
  }

  // Analytics and Reporting
  async getActivitySummary(filters?: {
    start_date?: Date;
    end_date?: Date;
    user_id?: number;
  }): Promise<{
    total_actions: number;
    actions_by_type: Record<string, number>;
    actions_by_user: Record<string, number>;
    daily_activity: Array<{ date: string; count: number }>;
  }> {
    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (filters?.start_date) {
      whereClause += ' AND al.created_at >= ?';
      queryParams.push(filters.start_date.toISOString());
    }

    if (filters?.end_date) {
      whereClause += ' AND al.created_at <= ?';
      queryParams.push(filters.end_date.toISOString());
    }

    if (filters?.user_id) {
      whereClause += ' AND al.user_id = ?';
      queryParams.push(filters.user_id);
    }

    // Total actions
    const totalResult = await this.db.queryFirst(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      queryParams
    );

    // Actions by type
    const actionsByType = await this.db.query(
      `SELECT action, COUNT(*) as count FROM audit_logs al ${whereClause} GROUP BY action ORDER BY count DESC`,
      queryParams
    );

    // Actions by user
    const actionsByUser = await this.db.query(`
      SELECT 
        COALESCE(u.first_name || ' ' || u.last_name, 'System') as user_name,
        COUNT(*) as count
      FROM audit_logs al 
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      GROUP BY al.user_id, user_name
      ORDER BY count DESC
    `, queryParams);

    // Daily activity
    const dailyActivity = await this.db.query(`
      SELECT 
        DATE(al.created_at) as date,
        COUNT(*) as count
      FROM audit_logs al
      ${whereClause}
      GROUP BY DATE(al.created_at)
      ORDER BY date DESC
      LIMIT 30
    `, queryParams);

    return {
      total_actions: totalResult.total,
      actions_by_type: actionsByType.reduce((acc, item) => {
        acc[item.action] = item.count;
        return acc;
      }, {}),
      actions_by_user: actionsByUser.reduce((acc, item) => {
        acc[item.user_name] = item.count;
        return acc;
      }, {}),
      daily_activity: dailyActivity
    };
  }

  async getSecurityEvents(filters?: {
    start_date?: Date;
    end_date?: Date;
    limit?: number;
  }): Promise<AuditLog[]> {
    const securityActions = [
      'USER_LOGIN',
      'USER_LOGOUT',
      'PASSWORD_CHANGED',
      'PERMISSION_GRANTED',
      'PERMISSION_REVOKED',
      'USER_CREATED',
      'USER_DEACTIVATED'
    ];

    let query = `
      SELECT 
        al.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.username as username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action IN (${securityActions.map(() => '?').join(',')})
    `;

    const queryParams = [...securityActions];

    if (filters?.start_date) {
      query += ' AND al.created_at >= ?';
      queryParams.push(filters.start_date.toISOString());
    }

    if (filters?.end_date) {
      query += ' AND al.created_at <= ?';
      queryParams.push(filters.end_date.toISOString());
    }

    query += ' ORDER BY al.created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      queryParams.push(filters.limit);
    }

    const logs = await this.db.query(query, queryParams);

    return logs.map(log => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null
    }));
  }

  // Data Retention
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.query(
      'DELETE FROM audit_logs WHERE created_at < ?',
      [cutoffDate.toISOString()]
    );

    return result.changes || 0;
  }

  async exportAuditLogs(filters?: {
    start_date?: Date;
    end_date?: Date;
    user_id?: number;
    entity_type?: EntityType;
    format: 'json' | 'csv';
  }): Promise<string> {
    const { logs } = await this.getAuditLogs({
      start_date: filters?.start_date,
      end_date: filters?.end_date,
      user_id: filters?.user_id,
      entity_type: filters?.entity_type,
      limit: 10000 // Export limit
    });

    if (filters?.format === 'csv') {
      return this.convertToCSV(logs);
    }

    return JSON.stringify(logs, null, 2);
  }

  private convertToCSV(logs: AuditLog[]): string {
    if (logs.length === 0) {
      return '';
    }

    const headers = [
      'ID',
      'User',
      'Action',
      'Entity Type',
      'Entity ID',
      'IP Address',
      'User Agent',
      'Created At'
    ];

    const rows = logs.map(log => [
      log.id,
      log.username || 'System',
      log.action,
      log.entity_type,
      log.entity_id,
      log.ip_address || '',
      log.user_agent || '',
      log.created_at
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    return csvContent;
  }
}