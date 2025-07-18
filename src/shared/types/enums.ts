export enum UserRole {
  SYSTEM_ADMIN = 'system_admin',
  PROJECT_MANAGER = 'project_manager',
  TEAM_MEMBER = 'team_member',
  CUSTOMER = 'customer'
}

export enum Status {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  ON_HOLD = 'on_hold',
  CANCELLED = 'cancelled'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum PhaseStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

export enum EntityType {
  EPIC = 'epic',
  STORY = 'story',
  TASK = 'task',
  SUBTASK = 'subtask',
  COMMENT = 'comment',
  USER = 'user',
  CUSTOMER = 'customer',
  TEMPLATE = 'template'
}

export enum PermissionLevel {
  FULL_ACCESS = 'full_access',
  PROJECT_SPECIFIC = 'project_specific',
  PHASE_SPECIFIC = 'phase_specific',
  READ_ONLY = 'read_only'
}

export enum NotificationType {
  MENTION = 'mention',
  ASSIGNMENT = 'assignment',
  PHASE_COMPLETION = 'phase_completion',
  DEADLINE_REMINDER = 'deadline_reminder',
  COMMENT_REPLY = 'comment_reply'
}

export enum FormFieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  EMAIL = 'email',
  DATE = 'date',
  DATETIME = 'datetime',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  FILE = 'file'
}

export enum CommentType {
  GENERAL = 'general',
  STATUS_UPDATE = 'status_update',
  APPROVAL_REQUEST = 'approval_request',
  FEEDBACK = 'feedback',
  QUESTION = 'question',
  RESOLUTION = 'resolution',
  INTERNAL = 'internal',
  CUSTOMER = 'customer'
}