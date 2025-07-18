export * from './enums';
export * from '../interfaces/entities';
export * from '../interfaces/api';

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type EntityWithRelations<T, R = {}> = T & R;

// Database types
export * from './database';

export interface QueryBuilder {
  select(fields?: string[]): QueryBuilder;
  where(field: string, operator: string, value: any): QueryBuilder;
  whereIn(field: string, values: any[]): QueryBuilder;
  orderBy(field: string, direction?: 'asc' | 'desc'): QueryBuilder;
  limit(count: number): QueryBuilder;
  offset(count: number): QueryBuilder;
  join(table: string, condition: string): QueryBuilder;
  leftJoin(table: string, condition: string): QueryBuilder;
  execute(): Promise<any[]>;
  first(): Promise<any>;
  count(): Promise<number>;
}

// Validation types
export interface ValidationSchema {
  [key: string]: ValidationRule[];
}

export interface ValidationRule {
  type: 'required' | 'string' | 'number' | 'email' | 'date' | 'boolean' | 'array' | 'object';
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

// Configuration types
export interface DatabaseConfig {
  type: 'sqlite' | 'mysql' | 'postgresql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  pool?: {
    min: number;
    max: number;
  };
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  upload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
    destination: string;
  };
}

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: {
    name: string;
    email: string;
  };
}

export interface ApplicationConfig {
  database: DatabaseConfig;
  server: ServerConfig;
  email: EmailConfig;
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
  };
  features: {
    enableRealTime: boolean;
    enableNotifications: boolean;
    enableAuditLog: boolean;
    enableFileUploads: boolean;
  };
}

// Event types for real-time updates
export interface EventPayload {
  timestamp: Date;
  user_id?: number;
  data: any;
}

export interface EntityCreatedEvent extends EventPayload {
  type: 'entity_created';
  entity_type: string;
  entity_id: number;
}

export interface EntityUpdatedEvent extends EventPayload {
  type: 'entity_updated';
  entity_type: string;
  entity_id: number;
  changes: Record<string, { old: any; new: any }>;
}

export interface EntityDeletedEvent extends EventPayload {
  type: 'entity_deleted';
  entity_type: string;
  entity_id: number;
}

export interface CommentAddedEvent extends EventPayload {
  type: 'comment_added';
  comment_id: number;
  entity_type: string;
  entity_id: number;
}

export interface AssignmentChangedEvent extends EventPayload {
  type: 'assignment_changed';
  entity_type: string;
  entity_id: number;
  old_assignee_id?: number;
  new_assignee_id?: number;
}

export type SystemEvent = 
  | EntityCreatedEvent 
  | EntityUpdatedEvent 
  | EntityDeletedEvent 
  | CommentAddedEvent 
  | AssignmentChangedEvent;

// Error types
export class ApplicationError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'ApplicationError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// Service types
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: ApplicationError;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Middleware types
export interface AuthUser {
  id: number;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
}

export interface AuthenticatedRequest {
  user?: AuthUser;
}

export interface RequestWithPagination {
  pagination?: {
    page: number;
    limit: number;
    offset: number;
  };
}

// Cache types
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string;
  tags?: string[];
}

export interface CacheEntry<T> {
  data: T;
  createdAt: Date;
  expiresAt?: Date;
  tags: string[];
}

// Task queue types
export interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledFor?: Date;
}

export interface JobProcessor<T = any> {
  (job: QueueJob & { data: T }): Promise<void>;
}

// Audit types
export interface AuditOptions {
  excludeFields?: string[];
  includeUserAgent?: boolean;
  includeIpAddress?: boolean;
}

// Template types
export interface TemplateProcessor {
  process(template: string, data: Record<string, any>): string;
}