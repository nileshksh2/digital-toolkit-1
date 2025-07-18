import { User, UserRole, PermissionLevel, ProjectPermission, UserPermissions, ProjectSpecificPermissions } from '../../shared/types';
import { DatabaseConnection } from '../../shared/types';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/types';

export class AccessControlService {
  constructor(private db: DatabaseConnection) {}

  // Permission Definitions
  private rolePermissions: Record<UserRole, string[]> = {
    [UserRole.SYSTEM_ADMIN]: [
      'can_create_epics',
      'can_edit_epics',
      'can_delete_epics',
      'can_view_epics',
      'can_create_stories',
      'can_edit_stories',
      'can_delete_stories',
      'can_view_stories',
      'can_create_tasks',
      'can_edit_tasks',
      'can_delete_tasks',
      'can_view_tasks',
      'can_create_subtasks',
      'can_edit_subtasks',
      'can_delete_subtasks',
      'can_view_subtasks',
      'can_manage_users',
      'can_manage_templates',
      'can_manage_customers',
      'can_access_all_projects',
      'can_manage_permissions',
      'can_view_audit_logs',
      'can_manage_phases',
      'can_export_data',
      'can_configure_system'
    ],
    [UserRole.PROJECT_MANAGER]: [
      'can_create_epics',
      'can_edit_epics',
      'can_view_epics',
      'can_create_stories',
      'can_edit_stories',
      'can_view_stories',
      'can_create_tasks',
      'can_edit_tasks',
      'can_view_tasks',
      'can_create_subtasks',
      'can_edit_subtasks',
      'can_view_subtasks',
      'can_manage_templates',
      'can_assign_tasks',
      'can_manage_team',
      'can_view_reports',
      'can_export_project_data'
    ],
    [UserRole.TEAM_MEMBER]: [
      'can_view_epics',
      'can_view_stories',
      'can_edit_stories',
      'can_view_tasks',
      'can_edit_tasks',
      'can_view_subtasks',
      'can_edit_subtasks',
      'can_comment',
      'can_upload_files',
      'can_view_assigned_work'
    ],
    [UserRole.CUSTOMER]: [
      'can_view_customer_portal',
      'can_comment_external',
      'can_view_progress',
      'can_upload_files'
    ]
  };

  async getUserPermissions(userId: number): Promise<UserPermissions> {
    const user = await this.getUserById(userId);
    
    // Get base role permissions
    const basePermissions = this.rolePermissions[user.role] || [];
    
    // Get project-specific permissions
    const projectPermissions = await this.getUserProjectPermissions(userId);
    
    // System admins have access to all projects
    const canAccessAllProjects = user.role === UserRole.SYSTEM_ADMIN;
    
    const permissions: UserPermissions = {
      can_create_epics: this.hasPermission(basePermissions, 'can_create_epics'),
      can_edit_epics: this.hasPermission(basePermissions, 'can_edit_epics'),
      can_delete_epics: this.hasPermission(basePermissions, 'can_delete_epics'),
      can_manage_users: this.hasPermission(basePermissions, 'can_manage_users'),
      can_manage_templates: this.hasPermission(basePermissions, 'can_manage_templates'),
      can_access_all_projects: canAccessAllProjects,
      project_permissions: projectPermissions
    };
    
    return permissions;
  }

  async getUserProjectPermissions(userId: number): Promise<Record<number, ProjectSpecificPermissions>> {
    const query = `
      SELECT 
        pp.*,
        e.title as epic_title,
        e.customer_id
      FROM project_permissions pp
      LEFT JOIN epics e ON pp.epic_id = e.id
      WHERE pp.user_id = ?
    `;
    
    const permissions = await this.db.query(query, [userId]);
    const result: Record<number, ProjectSpecificPermissions> = {};
    
    for (const perm of permissions) {
      const phaseRestrictions = perm.phase_restrictions ? JSON.parse(perm.phase_restrictions) : null;
      
      result[perm.epic_id] = {
        can_view: this.getProjectPermissionLevel(perm.permission_level, 'view'),
        can_edit: this.getProjectPermissionLevel(perm.permission_level, 'edit'),
        can_comment: this.getProjectPermissionLevel(perm.permission_level, 'comment'),
        can_manage_team: this.getProjectPermissionLevel(perm.permission_level, 'manage_team'),
        accessible_phases: phaseRestrictions || []
      };
    }
    
    return result;
  }

  async grantProjectPermission(data: {
    user_id: number;
    epic_id: number;
    permission_level: PermissionLevel;
    phase_restrictions?: number[];
    granted_by: number;
  }): Promise<ProjectPermission> {
    const { user_id, epic_id, permission_level, phase_restrictions, granted_by } = data;
    
    // Validate user exists
    await this.getUserById(user_id);
    
    // Validate epic exists
    const epic = await this.db.queryFirst('SELECT id FROM epics WHERE id = ?', [epic_id]);
    if (!epic) {
      throw new NotFoundError('Epic', epic_id);
    }
    
    // Validate granter has permission
    const granter = await this.getUserById(granted_by);
    if (granter.role !== UserRole.SYSTEM_ADMIN && granter.role !== UserRole.PROJECT_MANAGER) {
      throw new ForbiddenError('Only system administrators and project managers can grant permissions');
    }
    
    const query = `
      INSERT INTO project_permissions (
        user_id, epic_id, permission_level, phase_restrictions, granted_by, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, epic_id) DO UPDATE SET
        permission_level = excluded.permission_level,
        phase_restrictions = excluded.phase_restrictions,
        granted_by = excluded.granted_by,
        created_at = CURRENT_TIMESTAMP
    `;
    
    await this.db.query(query, [
      user_id,
      epic_id,
      permission_level,
      phase_restrictions ? JSON.stringify(phase_restrictions) : null,
      granted_by
    ]);
    
    return await this.getProjectPermission(user_id, epic_id);
  }

  async revokeProjectPermission(userId: number, epicId: number, revokedBy: number): Promise<void> {
    // Validate revoker has permission
    const revoker = await this.getUserById(revokedBy);
    if (revoker.role !== UserRole.SYSTEM_ADMIN && revoker.role !== UserRole.PROJECT_MANAGER) {
      throw new ForbiddenError('Only system administrators and project managers can revoke permissions');
    }
    
    await this.db.query(
      'DELETE FROM project_permissions WHERE user_id = ? AND epic_id = ?',
      [userId, epicId]
    );
  }

  async getProjectPermission(userId: number, epicId: number): Promise<ProjectPermission> {
    const query = `
      SELECT 
        pp.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        e.title as epic_title,
        granter.first_name as granter_first_name,
        granter.last_name as granter_last_name
      FROM project_permissions pp
      LEFT JOIN users u ON pp.user_id = u.id
      LEFT JOIN epics e ON pp.epic_id = e.id
      LEFT JOIN users granter ON pp.granted_by = granter.id
      WHERE pp.user_id = ? AND pp.epic_id = ?
    `;
    
    const permission = await this.db.queryFirst(query, [userId, epicId]);
    
    if (!permission) {
      throw new NotFoundError(`Project permission for user ${userId} and epic ${epicId}`);
    }
    
    if (permission.phase_restrictions) {
      permission.phase_restrictions = JSON.parse(permission.phase_restrictions);
    }
    
    return permission;
  }

  async getEpicPermissions(epicId: number): Promise<ProjectPermission[]> {
    const query = `
      SELECT 
        pp.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.role as user_role,
        granter.first_name as granter_first_name,
        granter.last_name as granter_last_name
      FROM project_permissions pp
      LEFT JOIN users u ON pp.user_id = u.id
      LEFT JOIN users granter ON pp.granted_by = granter.id
      WHERE pp.epic_id = ?
      ORDER BY u.last_name, u.first_name
    `;
    
    const permissions = await this.db.query(query, [epicId]);
    
    return permissions.map(perm => ({
      ...perm,
      phase_restrictions: perm.phase_restrictions ? JSON.parse(perm.phase_restrictions) : null
    }));
  }

  // Permission Checking Methods
  async hasEpicAccess(userId: number, epicId: number, action: 'view' | 'edit' | 'delete' = 'view'): Promise<boolean> {
    const user = await this.getUserById(userId);
    const permissions = await this.getUserPermissions(userId);
    
    // System admins have access to everything
    if (permissions.can_access_all_projects) {
      return true;
    }
    
    // Check if user is the project manager of this epic
    const epic = await this.db.queryFirst('SELECT project_manager_id FROM epics WHERE id = ?', [epicId]);
    if (epic && epic.project_manager_id === userId && action !== 'delete') {
      return true;
    }
    
    // Check project-specific permissions
    const projectPerm = permissions.project_permissions[epicId];
    if (!projectPerm) {
      return false;
    }
    
    switch (action) {
      case 'view':
        return projectPerm.can_view;
      case 'edit':
        return projectPerm.can_edit;
      case 'delete':
        return user.role === UserRole.SYSTEM_ADMIN;
      default:
        return false;
    }
  }

  async hasPhaseAccess(userId: number, epicId: number, phaseId: number): Promise<boolean> {
    const user = await this.getUserById(userId);
    
    // System admins have access to all phases
    if (user.role === UserRole.SYSTEM_ADMIN) {
      return true;
    }
    
    // Check if user has epic access first
    const hasEpicAccess = await this.hasEpicAccess(userId, epicId);
    if (!hasEpicAccess) {
      return false;
    }
    
    const permissions = await this.getUserPermissions(userId);
    const projectPerm = permissions.project_permissions[epicId];
    
    // If no phase restrictions, user has access to all phases
    if (!projectPerm || !projectPerm.accessible_phases || projectPerm.accessible_phases.length === 0) {
      return true;
    }
    
    return projectPerm.accessible_phases.includes(phaseId);
  }

  async canAssignTask(assignerId: number, assigneeId: number, epicId: number): Promise<boolean> {
    const assigner = await this.getUserById(assignerId);
    
    // System admins and project managers can assign tasks
    if (assigner.role === UserRole.SYSTEM_ADMIN || assigner.role === UserRole.PROJECT_MANAGER) {
      return true;
    }
    
    // Check if assigner has manage_team permission for this project
    const permissions = await this.getUserPermissions(assignerId);
    const projectPerm = permissions.project_permissions[epicId];
    
    return projectPerm?.can_manage_team || false;
  }

  async canAccessCustomerPortal(userId: number, epicId: number): Promise<boolean> {
    const user = await this.getUserById(userId);
    
    // Only customers can access customer portal
    if (user.role !== UserRole.CUSTOMER) {
      return false;
    }
    
    // Check if customer has access to this epic
    const epic = await this.db.queryFirst('SELECT customer_id FROM epics WHERE id = ?', [epicId]);
    if (!epic) {
      return false;
    }
    
    // Check if user belongs to the customer organization
    const customer = await this.db.queryFirst(
      'SELECT id FROM customers WHERE id = ? AND contact_email = ?',
      [epic.customer_id, user.email]
    );
    
    return !!customer;
  }

  // User Management
  async createUser(userData: {
    username: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    created_by: number;
  }): Promise<User> {
    const { username, email, password_hash, first_name, last_name, role, created_by } = userData;
    
    // Validate creator has permission
    const creator = await this.getUserById(created_by);
    if (creator.role !== UserRole.SYSTEM_ADMIN) {
      throw new ForbiddenError('Only system administrators can create users');
    }
    
    // Check for duplicate username/email
    const existingUser = await this.db.queryFirst(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUser) {
      throw new ValidationError('Username or email already exists');
    }
    
    const query = `
      INSERT INTO users (
        username, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    const result = await this.db.query(query, [
      username, email, password_hash, first_name, last_name, role
    ]);
    
    return await this.getUserById(result.insertId);
  }

  async updateUser(userId: number, updates: {
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: UserRole;
    is_active?: boolean;
    updated_by: number;
  }): Promise<User> {
    const { updated_by, ...userUpdates } = updates;
    
    // Validate updater has permission
    const updater = await this.getUserById(updated_by);
    if (updater.role !== UserRole.SYSTEM_ADMIN && updater.id !== userId) {
      throw new ForbiddenError('Only system administrators can update other users');
    }
    
    // Users can't change their own role
    if (updater.id === userId && userUpdates.role) {
      throw new ForbiddenError('Users cannot change their own role');
    }
    
    const existingUser = await this.getUserById(userId);
    
    // Check for duplicate username/email if being updated
    if (userUpdates.username || userUpdates.email) {
      const existingConflict = await this.db.queryFirst(
        'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
        [userUpdates.username || '', userUpdates.email || '', userId]
      );
      
      if (existingConflict) {
        throw new ValidationError('Username or email already exists');
      }
    }
    
    const updateFields = [];
    const updateValues = [];
    
    Object.entries(userUpdates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });
    
    if (updateFields.length === 0) {
      return existingUser;
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(userId);
    
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.query(query, updateValues);
    
    return await this.getUserById(userId);
  }

  async getUserById(id: number): Promise<User> {
    const user = await this.db.queryFirst(
      'SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at, last_login FROM users WHERE id = ?',
      [id]
    );
    
    if (!user) {
      throw new NotFoundError('User', id);
    }
    
    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.db.queryFirst(
      'SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at, last_login FROM users WHERE email = ? AND is_active = true',
      [email]
    );
    
    if (!user) {
      throw new NotFoundError('User with email', email);
    }
    
    return user;
  }

  async getAllUsers(filters?: {
    role?: UserRole;
    is_active?: boolean;
    search?: string;
  }): Promise<User[]> {
    let query = `
      SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at, last_login
      FROM users
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    if (filters?.role) {
      query += ' AND role = ?';
      queryParams.push(filters.role);
    }
    
    if (filters?.is_active !== undefined) {
      query += ' AND is_active = ?';
      queryParams.push(filters.is_active);
    }
    
    if (filters?.search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR username LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY last_name, first_name';
    
    return await this.db.query(query, queryParams);
  }

  // Utility Methods
  private hasPermission(permissions: string[], permission: string): boolean {
    return permissions.includes(permission);
  }

  private getProjectPermissionLevel(level: PermissionLevel, action: string): boolean {
    switch (level) {
      case PermissionLevel.FULL_ACCESS:
        return true;
      case PermissionLevel.PROJECT_SPECIFIC:
        return ['view', 'edit', 'comment'].includes(action);
      case PermissionLevel.PHASE_SPECIFIC:
        return ['view', 'comment'].includes(action);
      case PermissionLevel.READ_ONLY:
        return action === 'view';
      default:
        return false;
    }
  }

  // Bulk Permission Management
  async bulkGrantPermissions(data: {
    user_ids: number[];
    epic_id: number;
    permission_level: PermissionLevel;
    phase_restrictions?: number[];
    granted_by: number;
  }): Promise<ProjectPermission[]> {
    const { user_ids, epic_id, permission_level, phase_restrictions, granted_by } = data;
    
    const results = [];
    
    for (const userId of user_ids) {
      const permission = await this.grantProjectPermission({
        user_id: userId,
        epic_id,
        permission_level,
        phase_restrictions,
        granted_by
      });
      results.push(permission);
    }
    
    return results;
  }

  async getTeamMembers(epicId: number): Promise<User[]> {
    const query = `
      SELECT DISTINCT 
        u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.is_active,
        pp.permission_level
      FROM users u
      LEFT JOIN project_permissions pp ON u.id = pp.user_id AND pp.epic_id = ?
      LEFT JOIN epics e ON e.project_manager_id = u.id AND e.id = ?
      WHERE u.is_active = true 
        AND (pp.user_id IS NOT NULL OR e.project_manager_id IS NOT NULL OR u.role = 'system_admin')
      ORDER BY u.role, u.last_name, u.first_name
    `;
    
    return await this.db.query(query, [epicId, epicId]);
  }

  // Permission Analytics
  async getPermissionsSummary(epicId: number): Promise<{
    total_users: number;
    by_permission_level: Record<PermissionLevel, number>;
    by_role: Record<UserRole, number>;
    phase_restricted_users: number;
  }> {
    const permissions = await this.getEpicPermissions(epicId);
    
    const summary = {
      total_users: permissions.length,
      by_permission_level: {
        [PermissionLevel.FULL_ACCESS]: 0,
        [PermissionLevel.PROJECT_SPECIFIC]: 0,
        [PermissionLevel.PHASE_SPECIFIC]: 0,
        [PermissionLevel.READ_ONLY]: 0
      },
      by_role: {
        [UserRole.SYSTEM_ADMIN]: 0,
        [UserRole.PROJECT_MANAGER]: 0,
        [UserRole.TEAM_MEMBER]: 0,
        [UserRole.CUSTOMER]: 0
      },
      phase_restricted_users: 0
    };
    
    for (const perm of permissions) {
      summary.by_permission_level[perm.permission_level]++;
      summary.by_role[perm.user_role]++;
      
      if (perm.phase_restrictions && perm.phase_restrictions.length > 0) {
        summary.phase_restricted_users++;
      }
    }
    
    return summary;
  }
}