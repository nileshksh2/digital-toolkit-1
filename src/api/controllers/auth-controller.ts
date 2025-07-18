import { Request, Response } from 'express';
import { AuthService } from '../../modules/access-control/auth-service';
import { AccessControlService } from '../../modules/access-control/access-control-service';
import { ApiResponse, LoginRequest, CreateUserRequest, UpdateUserRequest } from '../../shared/types';
import { ValidationError, UnauthorizedError, ApplicationError } from '../../shared/types';
import { AuthenticatedRequest } from '../middleware/auth-middleware';

export class AuthController {
  constructor(
    private authService: AuthService,
    private accessControlService: AccessControlService
  ) {}

  async login(req: Request, res: Response): Promise<void> {
    try {
      const credentials: LoginRequest = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Check if account is locked
      if (await this.authService.isAccountLocked(credentials.username)) {
        const response: ApiResponse = {
          success: false,
          message: 'Account temporarily locked',
          errors: ['Too many failed login attempts. Please try again later.']
        };
        res.status(429).json(response);
        return;
      }

      try {
        const loginResult = await this.authService.login(credentials);

        // Clear any previous failed login attempts
        await this.authService.clearFailedLoginAttempts(credentials.username);

        // Create session
        await this.authService.createSession(loginResult.user.id, {
          ip_address: ipAddress,
          user_agent: userAgent
        });

        const response: ApiResponse = {
          success: true,
          data: loginResult,
          message: 'Login successful'
        };

        res.json(response);
      } catch (error) {
        // Track failed login attempt
        await this.authService.trackFailedLogin(credentials.username, ipAddress);

        if (error instanceof UnauthorizedError) {
          const response: ApiResponse = {
            success: false,
            message: 'Invalid credentials',
            errors: ['Username or password is incorrect']
          };
          res.status(401).json(response);
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user) {
        await this.authService.logout(req.user.id);
        await this.authService.invalidateAllUserSessions(req.user.id);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Logout successful'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async refreshToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        const response: ApiResponse = {
          success: false,
          message: 'Token required',
          errors: ['Authorization token is required']
        };
        res.status(400).json(response);
        return;
      }

      const refreshResult = await this.authService.refreshToken(token);

      const response: ApiResponse = {
        success: true,
        data: refreshResult,
        message: 'Token refreshed successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
          errors: ['Authentication required']
        };
        res.status(401).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: req.user
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
          errors: ['Authentication required']
        };
        res.status(401).json(response);
        return;
      }

      const { current_password, new_password } = req.body;

      await this.authService.changePassword({
        user_id: req.user.id,
        current_password,
        new_password
      });

      // Invalidate all other sessions to force re-login
      await this.authService.invalidateAllUserSessions(req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async resetPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { email, new_password } = req.body;

      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      await this.authService.resetPassword({
        email,
        new_password,
        reset_by: req.user.id
      });

      const response: ApiResponse = {
        success: true,
        message: 'Password reset successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // User Management
  async createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userData: CreateUserRequest = req.body;

      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      const user = await this.authService.createUserWithPassword({
        ...userData,
        created_by: req.user.id
      });

      // Remove password hash from response
      const { password_hash, ...userResponse } = user as any;

      const response: ApiResponse = {
        success: true,
        data: userResponse,
        message: 'User created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const updates: UpdateUserRequest = req.body;

      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      // Handle password update separately
      if (updates.new_password) {
        await this.authService.updateUserPassword(userId, updates.new_password, req.user.id);
        delete updates.new_password;
      }

      const user = await this.accessControlService.updateUser(userId, {
        ...updates,
        updated_by: req.user.id
      });

      // Remove password hash from response
      const { password_hash, ...userResponse } = user as any;

      const response: ApiResponse = {
        success: true,
        data: userResponse,
        message: 'User updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);

      const user = await this.accessControlService.getUserById(userId);

      // Remove password hash from response
      const { password_hash, ...userResponse } = user as any;

      const response: ApiResponse = {
        success: true,
        data: userResponse
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters = {
        role: req.query.role as any,
        is_active: req.query.is_active ? req.query.is_active === 'true' : undefined,
        search: req.query.search as string
      };

      const users = await this.accessControlService.getAllUsers(filters);

      // Remove password hashes from response
      const usersResponse = users.map(user => {
        const { password_hash, ...userWithoutPassword } = user as any;
        return userWithoutPassword;
      });

      const response: ApiResponse = {
        success: true,
        data: usersResponse
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async activateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);

      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      const user = await this.authService.activateUser(userId, req.user.id);

      // Remove password hash from response
      const { password_hash, ...userResponse } = user as any;

      const response: ApiResponse = {
        success: true,
        data: userResponse,
        message: 'User activated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async deactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);

      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication required',
          errors: ['User must be authenticated']
        };
        res.status(401).json(response);
        return;
      }

      const user = await this.authService.deactivateUser(userId, req.user.id);

      // Remove password hash from response
      const { password_hash, ...userResponse } = user as any;

      const response: ApiResponse = {
        success: true,
        data: userResponse,
        message: 'User deactivated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getUserSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);

      const sessions = await this.authService.getUserSessions(userId);

      const response: ApiResponse = {
        success: true,
        data: sessions
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getUserLoginHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 10;

      const history = await this.authService.getUserLoginHistory(userId, limit);

      const response: ApiResponse = {
        success: true,
        data: history
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private handleError(res: Response, error: any): void {
    console.error('Auth Controller Error:', error);

    if (error instanceof ValidationError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
      };
      res.status(400).json(response);
    } else if (error instanceof UnauthorizedError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
      };
      res.status(401).json(response);
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