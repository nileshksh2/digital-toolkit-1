import { UserRole, Status, Priority, PhaseStatus, EntityType, PermissionLevel, NotificationType, FormFieldType } from '../types/enums';

export interface BaseEntity {
  id: number;
  created_at: Date;
  updated_at: Date;
}

export interface User extends BaseEntity {
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  last_login?: Date;
}

export interface Customer extends BaseEntity {
  name: string;
  contact_email?: string;
  contact_phone?: string;
  organization?: string;
  portal_url_key?: string;
  is_active: boolean;
}

export interface Phase extends BaseEntity {
  name: string;
  sequence_order: number;
  description?: string;
  is_active: boolean;
}

export interface Template extends BaseEntity {
  name: string;
  description?: string;
  version: number;
  is_active: boolean;
  created_by: number;
}

export interface TemplateVersion extends BaseEntity {
  template_id: number;
  version_number: number;
  configuration: TemplateConfiguration;
  changes_description?: string;
  created_by: number;
}

export interface TemplateConfiguration {
  default_phases: number[];
  predefined_stories: PredefinedStory[];
  form_configurations: FormConfiguration[];
  workflow_rules: WorkflowRule[];
}

export interface PredefinedStory {
  title: string;
  description?: string;
  phase_id: number;
  estimated_hours?: number;
  predefined_tasks: PredefinedTask[];
}

export interface PredefinedTask {
  title: string;
  description?: string;
  estimated_hours?: number;
  predefined_subtasks: PredefinedSubtask[];
}

export interface PredefinedSubtask {
  title: string;
  description?: string;
  estimated_hours?: number;
}

export interface WorkflowRule {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

export interface WorkflowTrigger {
  event: string;
  entity_type: EntityType;
}

export interface WorkflowCondition {
  field: string;
  operator: string;
  value: any;
}

export interface WorkflowAction {
  type: string;
  parameters: Record<string, any>;
}

export interface Epic extends BaseEntity {
  title: string;
  description?: string;
  customer_id: number;
  template_id?: number;
  current_phase_id: number;
  status: Status;
  priority: Priority;
  start_date?: Date;
  end_date?: Date;
  estimated_hours?: number;
  actual_hours?: number;
  project_manager_id?: number;
  created_by: number;
  
  // Relationships
  customer?: Customer;
  template?: Template;
  current_phase?: Phase;
  project_manager?: User;
  creator?: User;
  stories?: Story[];
  epic_phases?: EpicPhase[];
}

export interface EpicPhase extends BaseEntity {
  epic_id: number;
  phase_id: number;
  status: PhaseStatus;
  start_date?: Date;
  end_date?: Date;
  completion_percentage: number;
  notes?: string;
  sequence_order?: number;
  phase_name?: string;
  
  // Relationships
  epic?: Epic;
  phase?: Phase;
}

export interface Story extends BaseEntity {
  epic_id: number;
  title: string;
  description?: string;
  phase_id: number;
  status: Status;
  priority: Priority;
  assignee_id?: number;
  start_date?: Date;
  due_date?: Date;
  estimated_hours?: number;
  actual_hours?: number;
  completion_percentage: number;
  sequence_order?: number;
  created_by: number;
  
  // Relationships
  epic?: Epic;
  phase?: Phase;
  assignee?: User;
  creator?: User;
  tasks?: Task[];
}

export interface Task extends BaseEntity {
  story_id: number;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  assignee_id?: number;
  start_date?: Date;
  due_date?: Date;
  estimated_hours?: number;
  actual_hours?: number;
  completion_percentage: number;
  sequence_order?: number;
  created_by: number;
  
  // Relationships
  story?: Story;
  assignee?: User;
  creator?: User;
  subtasks?: Subtask[];
}

export interface Subtask extends BaseEntity {
  task_id: number;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  assignee_id?: number;
  start_date?: Date;
  due_date?: Date;
  estimated_hours?: number;
  actual_hours?: number;
  is_completed: boolean;
  sequence_order?: number;
  created_by: number;
  
  // Relationships
  task?: Task;
  assignee?: User;
  creator?: User;
}

export interface Comment extends BaseEntity {
  entity_type: EntityType;
  entity_id: number;
  content: string;
  is_internal: boolean;
  author_id: number;
  mentioned_users?: number[];
  attachments?: CommentAttachment[];
  edited_at?: Date;
  parent_comment_id?: number;
  
  // Relationships
  author?: User;
}

export interface CommentAttachment {
  id: number;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
}

export interface CommentThread {
  id: number;
  entity_type: EntityType;
  entity_id: number;
  comments: Comment[];
  total_comments: number;
  last_comment_at?: Date;
}

export interface CommentNotification {
  id: number;
  user_id: number;
  comment_id: number;
  type: NotificationType;
  is_read: boolean;
  created_at: Date;
  
  // Relationships
  user?: User;
  comment?: Comment;
}

export interface Attachment extends BaseEntity {
  entity_type: EntityType;
  entity_id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by: number;
  
  // Relationships
  uploader?: User;
}

export interface FormConfiguration {
  id: number;
  name: string;
  description?: string;
  entity_type: EntityType;
  fields: FormField[];
  is_active: boolean;
  created_by?: number;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  name: string;
  placeholder?: string;
  required: boolean;
  validation_rules?: FormValidationRule[];
  options?: FormFieldOption[];
  conditional_logic?: ConditionalLogic;
  default_value?: any;
}

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormValidationRule {
  type: string;
  value?: any;
  message: string;
}

export interface ConditionalLogic {
  show_if: ConditionalRule[];
  hide_if?: ConditionalRule[];
}

export interface ConditionalRule {
  field: string;
  operator: string;
  value: any;
}

export interface FormSubmission extends BaseEntity {
  form_id: number;
  entity_type: EntityType;
  entity_id: number;
  submission_data: Record<string, any>;
  submitted_by: number;
  
  // Relationships
  form?: FormConfiguration;
  submitter?: User;
}

export interface ProjectPermission extends BaseEntity {
  user_id: number;
  epic_id: number;
  permission_level: PermissionLevel;
  phase_restrictions?: number[];
  granted_by?: number;
  
  // Relationships
  user?: User;
  epic?: Epic;
  granter?: User;
}

export interface CustomerPortalSettings extends BaseEntity {
  customer_id: number;
  epic_id: number;
  visibility_settings: PortalVisibilitySettings;
  custom_branding?: PortalBranding;
  is_active: boolean;
  
  // Relationships
  customer?: Customer;
  epic?: Epic;
}

export interface PortalVisibilitySettings {
  show_phases: boolean;
  show_stories: boolean;
  show_tasks: boolean;
  show_subtasks: boolean;
  show_comments: boolean;
  show_attachments: boolean;
  show_timeline: boolean;
  show_team_members: boolean;
  allowed_phases?: number[];
  custom_fields?: string[];
}

export interface PortalBranding {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  custom_css?: string;
  company_name?: string;
}

export interface AuditLog extends BaseEntity {
  user_id?: number;
  action: string;
  entity_type: EntityType;
  entity_id: number;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  
  // Relationships
  user?: User;
}

export interface Notification extends BaseEntity {
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: EntityType;
  entity_id?: number;
  is_read: boolean;
  
  // Relationships
  user?: User;
}