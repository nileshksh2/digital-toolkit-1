import { Epic, Story, Task, Subtask, User, Customer, Comment, Attachment, FormSubmission, Notification } from './entities';
import { Status, Priority, UserRole } from '../types/enums';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  total_pages?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FilterParams {
  status?: Status | Status[];
  priority?: Priority | Priority[];
  assignee_id?: number | number[];
  phase_id?: number | number[];
  start_date?: string;
  end_date?: string;
  search?: string;
}

// Auth interfaces
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
  expires_in: number;
}

export interface AuthUser extends Omit<User, 'password_hash'> {
  permissions?: UserPermissions;
}

export interface UserPermissions {
  can_create_epics: boolean;
  can_edit_epics: boolean;
  can_delete_epics: boolean;
  can_manage_users: boolean;
  can_manage_templates: boolean;
  can_access_all_projects: boolean;
  project_permissions: Record<number, ProjectSpecificPermissions>;
}

export interface ProjectSpecificPermissions {
  can_view: boolean;
  can_edit: boolean;
  can_comment: boolean;
  can_manage_team: boolean;
  accessible_phases: number[];
}

// Epic interfaces
export interface CreateEpicRequest {
  title: string;
  description?: string;
  customer_id: number;
  template_id?: number;
  priority: Priority;
  start_date?: string;
  end_date?: string;
  estimated_hours?: number;
  project_manager_id?: number;
}

export interface UpdateEpicRequest extends Partial<CreateEpicRequest> {
  status?: Status;
  current_phase_id?: number;
  actual_hours?: number;
}

export interface EpicSummary {
  epic: Epic;
  stats: {
    total_stories: number;
    completed_stories: number;
    total_tasks: number;
    completed_tasks: number;
    total_subtasks: number;
    completed_subtasks: number;
    overall_completion_percentage: number;
    phase_completion_percentages: Record<number, number>;
  };
  timeline: PhaseTimeline[];
  team_members: User[];
}

export interface PhaseTimeline {
  phase_id: number;
  phase_name: string;
  status: Status;
  start_date?: Date;
  end_date?: Date;
  completion_percentage: number;
  estimated_duration?: number;
  actual_duration?: number;
}

// Story interfaces
export interface CreateStoryRequest {
  epic_id: number;
  title: string;
  description?: string;
  phase_id: number;
  priority: Priority;
  assignee_id?: number;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  sequence_order?: number;
}

export interface UpdateStoryRequest extends Partial<CreateStoryRequest> {
  status?: Status;
  actual_hours?: number;
  completion_percentage?: number;
}

export interface BulkUpdateRequest {
  story_ids: number[];
  updates: {
    status?: Status;
    priority?: Priority;
    assignee_id?: number;
    phase_id?: number;
    due_date?: string;
  };
}

// Task interfaces
export interface CreateTaskRequest {
  story_id: number;
  title: string;
  description?: string;
  priority: Priority;
  assignee_id?: number;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  sequence_order?: number;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  status?: Status;
  actual_hours?: number;
  completion_percentage?: number;
}

// Subtask interfaces
export interface CreateSubtaskRequest {
  task_id: number;
  title: string;
  description?: string;
  priority: Priority;
  assignee_id?: number;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  sequence_order?: number;
}

export interface UpdateSubtaskRequest extends Partial<CreateSubtaskRequest> {
  status?: Status;
  actual_hours?: number;
  is_completed?: boolean;
}

// Comment interfaces
export interface CreateCommentRequest {
  entity_type: 'epic' | 'story' | 'task' | 'subtask';
  entity_id: number;
  content: string;
  is_internal: boolean;
  mentioned_users?: number[];
  attachments?: File[];
}

export interface UpdateCommentRequest {
  content: string;
  mentioned_users?: number[];
}

// User interfaces
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
}

export interface UpdateUserRequest extends Partial<Omit<CreateUserRequest, 'password'>> {
  is_active?: boolean;
  new_password?: string;
}

// Customer interfaces
export interface CreateCustomerRequest {
  name: string;
  contact_email?: string;
  contact_phone?: string;
  organization?: string;
}

export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {
  is_active?: boolean;
}

// Dashboard interfaces
export interface DashboardData {
  user: AuthUser;
  overview: DashboardOverview;
  recent_activities: RecentActivity[];
  my_assignments: MyAssignments;
  notifications: Notification[];
}

export interface DashboardOverview {
  total_epics: number;
  active_epics: number;
  completed_epics: number;
  total_stories: number;
  my_stories: number;
  overdue_items: number;
  upcoming_deadlines: UpcomingDeadline[];
}

export interface MyAssignments {
  stories: Story[];
  tasks: Task[];
  subtasks: Subtask[];
}

export interface RecentActivity {
  id: number;
  type: string;
  description: string;
  entity_type: string;
  entity_id: number;
  entity_title: string;
  user: Pick<User, 'id' | 'first_name' | 'last_name'>;
  created_at: Date;
}

export interface UpcomingDeadline {
  id: number;
  title: string;
  type: 'story' | 'task' | 'subtask';
  due_date: Date;
  days_remaining: number;
  assignee: Pick<User, 'id' | 'first_name' | 'last_name'>;
}

// Customer Portal interfaces
export interface CustomerPortalData {
  epic: Epic;
  visibility_settings: any;
  progress_summary: {
    overall_completion: number;
    phase_progress: Record<number, number>;
    timeline: PhaseTimeline[];
  };
  recent_updates: RecentActivity[];
  customer_comments: Comment[];
}

// WebSocket interfaces
export interface SocketEvent {
  type: string;
  payload: any;
  user_id?: number;
  room?: string;
}

export interface RealTimeUpdate {
  event_type: 'entity_updated' | 'comment_added' | 'assignment_changed' | 'phase_completed';
  entity_type: string;
  entity_id: number;
  data: any;
  timestamp: Date;
}

// File upload interfaces
export interface FileUploadResponse {
  id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  upload_url?: string;
}

// Search interfaces
export interface SearchRequest {
  query: string;
  entity_types?: string[];
  filters?: FilterParams;
  pagination?: PaginationParams;
}

export interface SearchResult {
  type: string;
  id: number;
  title: string;
  description?: string;
  highlight: string;
  breadcrumb: string[];
  url: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  suggestions?: string[];
}

// Reporting interfaces
export interface ReportRequest {
  type: 'phase_completion' | 'team_performance' | 'project_timeline' | 'custom';
  date_range: {
    start_date: string;
    end_date: string;
  };
  filters?: {
    epic_ids?: number[];
    user_ids?: number[];
    phase_ids?: number[];
  };
  format: 'json' | 'pdf' | 'excel';
}

export interface ReportData {
  title: string;
  generated_at: Date;
  parameters: ReportRequest;
  data: any;
  charts?: ChartData[];
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: any;
  options?: any;
}