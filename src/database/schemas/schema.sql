-- Implementation Monitoring System Database Schema
-- Hierarchical project management with Epic->Stories->Tasks->Subtasks

-- Users table for authentication and role management
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK(role IN ('system_admin', 'project_manager', 'team_member', 'customer')),
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    organization VARCHAR(100),
    portal_url_key VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Templates table for reusable project templates
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Template versions for version control
CREATE TABLE IF NOT EXISTS template_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    configuration JSON NOT NULL,
    changes_description TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(template_id, version_number)
);

-- Phases lookup table
CREATE TABLE IF NOT EXISTS phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    sequence_order INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Insert default phases
INSERT OR IGNORE INTO phases (name, sequence_order, description) VALUES
('Design', 1, 'Project design and planning phase'),
('Configuration', 2, 'System configuration and setup phase'),
('Testing', 3, 'Testing and quality assurance phase'),
('Promotion', 4, 'Production deployment and go-live phase');

-- Projects/Epics table (top level)
CREATE TABLE IF NOT EXISTS epics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    customer_id INTEGER NOT NULL,
    template_id INTEGER,
    current_phase_id INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed', 'on_hold', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    start_date DATE,
    end_date DATE,
    estimated_hours DECIMAL(10,2),
    actual_hours DECIMAL(10,2),
    project_manager_id INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (template_id) REFERENCES templates(id),
    FOREIGN KEY (current_phase_id) REFERENCES phases(id),
    FOREIGN KEY (project_manager_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Epic phase tracking
CREATE TABLE IF NOT EXISTS epic_phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    epic_id INTEGER NOT NULL,
    phase_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed')),
    start_date DATE,
    end_date DATE,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE CASCADE,
    FOREIGN KEY (phase_id) REFERENCES phases(id),
    UNIQUE(epic_id, phase_id)
);

-- Stories table (second level)
CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    epic_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    phase_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed', 'blocked')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    assignee_id INTEGER,
    start_date DATE,
    due_date DATE,
    estimated_hours DECIMAL(8,2),
    actual_hours DECIMAL(8,2),
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    sequence_order INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE CASCADE,
    FOREIGN KEY (phase_id) REFERENCES phases(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tasks table (third level)
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed', 'blocked')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    assignee_id INTEGER,
    start_date DATE,
    due_date DATE,
    estimated_hours DECIMAL(6,2),
    actual_hours DECIMAL(6,2),
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    sequence_order INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Subtasks table (fourth level)
CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed', 'blocked')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    assignee_id INTEGER,
    start_date DATE,
    due_date DATE,
    estimated_hours DECIMAL(4,2),
    actual_hours DECIMAL(4,2),
    is_completed BOOLEAN DEFAULT false,
    sequence_order INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Comments table with dual-layer support (internal/external)
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type VARCHAR(20) NOT NULL CHECK(entity_type IN ('epic', 'story', 'task', 'subtask')),
    entity_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT true,
    author_id INTEGER NOT NULL,
    mentioned_users JSON,
    attachments JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited_at DATETIME,
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- File attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type VARCHAR(20) NOT NULL CHECK(entity_type IN ('epic', 'story', 'task', 'subtask', 'comment')),
    entity_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Forms configuration table
CREATE TABLE IF NOT EXISTS forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    entity_type VARCHAR(20) NOT NULL CHECK(entity_type IN ('epic', 'story', 'task', 'subtask')),
    configuration JSON NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Form submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK(entity_type IN ('epic', 'story', 'task', 'subtask')),
    entity_id INTEGER NOT NULL,
    submission_data JSON NOT NULL,
    submitted_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(id),
    FOREIGN KEY (submitted_by) REFERENCES users(id)
);

-- Project permissions table
CREATE TABLE IF NOT EXISTS project_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    epic_id INTEGER NOT NULL,
    permission_level VARCHAR(30) NOT NULL CHECK(permission_level IN ('full_access', 'project_specific', 'phase_specific', 'read_only')),
    phase_restrictions JSON,
    granted_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id),
    UNIQUE(user_id, epic_id)
);

-- Customer portal settings
CREATE TABLE IF NOT EXISTS customer_portal_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    epic_id INTEGER NOT NULL,
    visibility_settings JSON NOT NULL,
    custom_branding JSON,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE CASCADE,
    UNIQUE(customer_id, epic_id)
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK(entity_type IN ('epic', 'story', 'task', 'subtask', 'user', 'customer', 'template', 'comment')),
    entity_id INTEGER NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(30) NOT NULL CHECK(type IN ('mention', 'assignment', 'phase_completion', 'deadline_reminder', 'comment_reply')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(20) CHECK(entity_type IN ('epic', 'story', 'task', 'subtask', 'comment')),
    entity_id INTEGER,
    is_read BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_stories_epic_id ON stories(epic_id);
CREATE INDEX IF NOT EXISTS idx_stories_phase_id ON stories(phase_id);
CREATE INDEX IF NOT EXISTS idx_stories_assignee_id ON stories(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_story_id ON tasks(story_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_assignee_id ON subtasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_epic_phases_epic ON epic_phases(epic_id);
CREATE INDEX IF NOT EXISTS idx_project_permissions_user ON project_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_project_permissions_epic ON project_permissions(epic_id);