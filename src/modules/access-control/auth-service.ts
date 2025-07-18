import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, UserRole, LoginRequest, LoginResponse, AuthUser } from '../../shared/types';
import { DatabaseConnection } from '../../shared/types';
import { NotFoundError, ValidationError, UnauthorizedError, ApplicationError } from '../../shared/types';
import { AccessControlService } from './access-control-service';

export class AuthService {
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private bcryptRounds: number;

  constructor(
    private db: DatabaseConnection,
    private accessControlService: AccessControlService,
    config: {
      jwtSecret: string;
      jwtExpiresIn: string;
      bcryptRounds: number;
    }
  ) {
    this.jwtSecret = config.jwtSecret;
    this.jwtExpiresIn = config.jwtExpiresIn;
    this.bcryptRounds = config.bcryptRounds;
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { username, password } = credentials;

    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    // Find user by username or email
    const userQuery = `
      SELECT id, username, email, password_hash, first_name, last_name, role, is_active, last_login
      FROM users 
      WHERE (username = ? OR email = ?) AND is_active = true
    `;

    const user = await this.db.queryFirst(userQuery, [username, username]);

    if (!user) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Update last login
    await this.db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Get user permissions
    const permissions = await this.accessControlService.getUserPermissions(user.id);

    // Create JWT token
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(tokenPayload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    // Calculate expiration time
    const expiresIn = this.parseExpirationTime(this.jwtExpiresIn);

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: new Date(),
      permissions
    };

    return {
      user: authUser,
      token,
      expires_in: expiresIn
    };
  }

  async logout(userId: number): Promise<void> {
    // In a production system, you might want to blacklist the token
    // For now, we'll just update the user's last activity
    await this.db.query(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
  }

  async validateToken(token: string): Promise<AuthUser> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      const user = await this.accessControlService.getUserById(decoded.userId);
      
      if (!user.is_active) {
        throw new UnauthorizedError('User account is disabled');
      }

      const permissions = await this.accessControlService.getUserPermissions(user.id);

      return {
        ...user,
        permissions
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      throw error;
    }
  }

  async refreshToken(token: string): Promise<LoginResponse> {
    const authUser = await this.validateToken(token);
    
    // Create new token
    const tokenPayload = {
      userId: authUser.id,
      username: authUser.username,
      email: authUser.email,
      role: authUser.role
    };

    const newToken = jwt.sign(tokenPayload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const expiresIn = this.parseExpirationTime(this.jwtExpiresIn);

    return {
      user: authUser,
      token: newToken,
      expires_in: expiresIn
    };
  }

  async changePassword(data: {
    user_id: number;
    current_password: string;
    new_password: string;
  }): Promise<void> {
    const { user_id, current_password, new_password } = data;

    // Get user with password hash
    const user = await this.db.queryFirst(
      'SELECT password_hash FROM users WHERE id = ? AND is_active = true',
      [user_id]
    );

    if (!user) {
      throw new NotFoundError('User', user_id);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Validate new password
    this.validatePassword(new_password);

    // Hash new password
    const hashedPassword = await this.hashPassword(new_password);

    // Update password
    await this.db.query(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, user_id]
    );
  }

  async resetPassword(data: {
    email: string;
    new_password: string;
    reset_by: number;
  }): Promise<void> {
    const { email, new_password, reset_by } = data;

    // Validate reset permissions
    const resetBy = await this.accessControlService.getUserById(reset_by);
    if (resetBy.role !== UserRole.SYSTEM_ADMIN) {
      throw new ValidationError('Only system administrators can reset passwords');
    }

    // Find user
    const user = await this.accessControlService.getUserByEmail(email);

    // Validate new password
    this.validatePassword(new_password);

    // Hash new password
    const hashedPassword = await this.hashPassword(new_password);

    // Update password
    await this.db.query(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, user.id]
    );
  }

  async createUserWithPassword(userData: {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    created_by: number;
  }): Promise<User> {
    const { password, ...userInfo } = userData;

    // Validate password
    this.validatePassword(password);

    // Hash password
    const password_hash = await this.hashPassword(password);

    // Create user
    return await this.accessControlService.createUser({
      ...userInfo,
      password_hash
    });
  }

  async updateUserPassword(userId: number, newPassword: string, updatedBy: number): Promise<void> {
    // Validate update permissions
    const updater = await this.accessControlService.getUserById(updatedBy);
    if (updater.role !== UserRole.SYSTEM_ADMIN && updater.id !== userId) {
      throw new ValidationError('Only system administrators can update other user passwords');
    }

    // Validate password
    this.validatePassword(newPassword);

    // Hash password
    const hashedPassword = await this.hashPassword(newPassword);

    // Update password
    await this.db.query(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId]
    );
  }

  // Session Management
  async createSession(userId: number, metadata: {
    ip_address?: string;
    user_agent?: string;
  }): Promise<string> {
    const sessionId = this.generateSessionId();
    
    const query = `
      INSERT INTO user_sessions (
        id, user_id, ip_address, user_agent, created_at, last_activity, is_active
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true)
    `;

    await this.db.query(query, [
      sessionId,
      userId,
      metadata.ip_address,
      metadata.user_agent
    ]);

    return sessionId;
  }

  async validateSession(sessionId: string): Promise<User | null> {
    const session = await this.db.queryFirst(`
      SELECT 
        s.*,
        u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.is_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.is_active = true AND u.is_active = true
    `, [sessionId]);

    if (!session) {
      return null;
    }

    // Check if session is expired (sessions expire after 30 days of inactivity)
    const lastActivity = new Date(session.last_activity);
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

    if (lastActivity < thirtyDaysAgo) {
      await this.invalidateSession(sessionId);
      return null;
    }

    // Update last activity
    await this.db.query(
      'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?',
      [sessionId]
    );

    return {
      id: session.id,
      username: session.username,
      email: session.email,
      first_name: session.first_name,
      last_name: session.last_name,
      role: session.role,
      is_active: session.is_active,
      created_at: session.created_at,
      updated_at: session.updated_at,
      last_login: session.last_login
    } as User;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.db.query(
      'UPDATE user_sessions SET is_active = false WHERE id = ?',
      [sessionId]
    );
  }

  async invalidateAllUserSessions(userId: number): Promise<void> {
    await this.db.query(
      'UPDATE user_sessions SET is_active = false WHERE user_id = ?',
      [userId]
    );
  }

  async getUserSessions(userId: number): Promise<Array<{
    id: string;
    ip_address?: string;
    user_agent?: string;
    created_at: Date;
    last_activity: Date;
    is_current?: boolean;
  }>> {
    const query = `
      SELECT id, ip_address, user_agent, created_at, last_activity
      FROM user_sessions
      WHERE user_id = ? AND is_active = true
      ORDER BY last_activity DESC
    `;

    return await this.db.query(query, [userId]);
  }

  // Account Security
  async trackFailedLogin(identifier: string, ipAddress?: string): Promise<void> {
    const query = `
      INSERT INTO failed_login_attempts (
        identifier, ip_address, attempted_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP)
    `;

    await this.db.query(query, [identifier, ipAddress]);
  }

  async getFailedLoginAttempts(identifier: string, timeframe = 15): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM failed_login_attempts
      WHERE identifier = ? 
        AND attempted_at > datetime('now', '-${timeframe} minutes')
    `;

    const result = await this.db.queryFirst(query, [identifier]);
    return result.count || 0;
  }

  async isAccountLocked(identifier: string): Promise<boolean> {
    const failedAttempts = await this.getFailedLoginAttempts(identifier);
    return failedAttempts >= 5; // Lock after 5 failed attempts
  }

  async clearFailedLoginAttempts(identifier: string): Promise<void> {
    await this.db.query(
      'DELETE FROM failed_login_attempts WHERE identifier = ?',
      [identifier]
    );
  }

  // Password strength validation
  private validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      throw new ValidationError('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      throw new ValidationError('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      throw new ValidationError('Password must contain at least one number');
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
      throw new ValidationError('Password must contain at least one special character (@$!%*?&)');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.bcryptRounds);
  }

  private parseExpirationTime(expiration: string): number {
    const match = expiration.match(/^(\d+)([hmsd])$/);
    if (!match) {
      return 3600; // Default to 1 hour
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 3600;
    }
  }

  private generateSessionId(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  // User Account Management
  async activateUser(userId: number, activatedBy: number): Promise<User> {
    return await this.accessControlService.updateUser(userId, {
      is_active: true,
      updated_by: activatedBy
    });
  }

  async deactivateUser(userId: number, deactivatedBy: number): Promise<User> {
    // Invalidate all user sessions
    await this.invalidateAllUserSessions(userId);

    return await this.accessControlService.updateUser(userId, {
      is_active: false,
      updated_by: deactivatedBy
    });
  }

  async getUserLoginHistory(userId: number, limit = 10): Promise<Array<{
    login_time: Date;
    ip_address?: string;
    user_agent?: string;
    session_duration?: number;
  }>> {
    const query = `
      SELECT 
        created_at as login_time,
        ip_address,
        user_agent,
        CASE 
          WHEN is_active = false 
          THEN (julianday(updated_at) - julianday(created_at)) * 24 * 60 * 60
          ELSE NULL 
        END as session_duration
      FROM user_sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return await this.db.query(query, [userId, limit]);
  }

  // Two-Factor Authentication (placeholder for future implementation)
  async enableTwoFactor(userId: number): Promise<{ secret: string; qr_code: string }> {
    // Placeholder for 2FA implementation
    throw new ApplicationError('Two-factor authentication not yet implemented');
  }

  async verifyTwoFactor(userId: number, token: string): Promise<boolean> {
    // Placeholder for 2FA implementation
    throw new ApplicationError('Two-factor authentication not yet implemented');
  }

  async disableTwoFactor(userId: number): Promise<void> {
    // Placeholder for 2FA implementation
    throw new ApplicationError('Two-factor authentication not yet implemented');
  }
}