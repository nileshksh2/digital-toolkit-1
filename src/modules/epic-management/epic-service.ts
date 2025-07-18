import { Epic, Story, Task, Subtask, Status, Priority, User, Customer } from '../../shared/types';
import { DatabaseConnection, QueryBuilder } from '../../shared/types';
import { NotFoundError, ValidationError, ApplicationError } from '../../shared/types';
import { PhaseService } from '../phase-tracking/phase-service';

export class EpicService {
  constructor(
    private db: DatabaseConnection,
    private phaseService: PhaseService
  ) {}

  async createEpic(epicData: {
    title: string;
    description?: string;
    customer_id: number;
    template_id?: number;
    priority: Priority;
    start_date?: Date;
    end_date?: Date;
    estimated_hours?: number;
    project_manager_id?: number;
    created_by: number;
  }): Promise<Epic> {
    const {
      title,
      description,
      customer_id,
      template_id,
      priority,
      start_date,
      end_date,
      estimated_hours,
      project_manager_id,
      created_by
    } = epicData;

    // Validate customer exists
    const customer = await this.db.queryFirst(
      'SELECT id FROM customers WHERE id = ? AND is_active = true',
      [customer_id]
    );

    if (!customer) {
      throw new NotFoundError('Customer', customer_id);
    }

    // Validate project manager if provided
    if (project_manager_id) {
      const projectManager = await this.db.queryFirst(
        'SELECT id FROM users WHERE id = ? AND (role = "project_manager" OR role = "system_admin")',
        [project_manager_id]
      );

      if (!projectManager) {
        throw new ValidationError('Project manager must be a user with project manager or system admin role');
      }
    }

    const transaction = await this.db.beginTransaction();

    try {
      // Create epic
      const epicQuery = `
        INSERT INTO epics (
          title, description, customer_id, template_id, current_phase_id, 
          status, priority, start_date, end_date, estimated_hours, 
          project_manager_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      const epicResult = await this.db.query(epicQuery, [
        title, description, customer_id, template_id, Status.NOT_STARTED,
        priority, start_date, end_date, estimated_hours, project_manager_id, created_by
      ]);

      const epicId = epicResult.insertId;

      // Initialize epic phases
      await this.phaseService.initializeEpicPhases(epicId);

      // If template is provided, create predefined stories
      if (template_id) {
        await this.createStoriesFromTemplate(epicId, template_id, created_by);
      }

      await transaction.commit();

      return await this.getEpicById(epicId);

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getEpicById(id: number): Promise<Epic> {
    const query = `
      SELECT 
        e.*,
        c.name as customer_name,
        c.organization as customer_organization,
        pm.first_name as pm_first_name,
        pm.last_name as pm_last_name,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        p.name as current_phase_name
      FROM epics e
      LEFT JOIN customers c ON e.customer_id = c.id
      LEFT JOIN users pm ON e.project_manager_id = pm.id
      LEFT JOIN users creator ON e.created_by = creator.id
      LEFT JOIN phases p ON e.current_phase_id = p.id
      WHERE e.id = ?
    `;

    const epic = await this.db.queryFirst(query, [id]);

    if (!epic) {
      throw new NotFoundError('Epic', id);
    }

    return epic;
  }

  async updateEpic(id: number, updates: Partial<Epic>): Promise<Epic> {
    const existingEpic = await this.getEpicById(id);

    const updateFields = [];
    const updateValues = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      return existingEpic;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const query = `UPDATE epics SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.query(query, updateValues);

    return await this.getEpicById(id);
  }

  async deleteEpic(id: number): Promise<void> {
    const epic = await this.getEpicById(id);

    // Check if epic has stories
    const storyCount = await this.db.queryFirst(
      'SELECT COUNT(*) as count FROM stories WHERE epic_id = ?',
      [id]
    );

    if (storyCount.count > 0) {
      throw new ValidationError(`Cannot delete epic '${epic.title}' as it has ${storyCount.count} associated stories`);
    }

    await this.db.query('DELETE FROM epics WHERE id = ?', [id]);
  }

  async getEpicStories(epicId: number, filters?: {
    phase_id?: number;
    status?: Status;
    assignee_id?: number;
  }): Promise<Story[]> {
    let query = `
      SELECT 
        s.*,
        p.name as phase_name,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name
      FROM stories s
      LEFT JOIN phases p ON s.phase_id = p.id
      LEFT JOIN users assignee ON s.assignee_id = assignee.id
      LEFT JOIN users creator ON s.created_by = creator.id
      WHERE s.epic_id = ?
    `;

    const queryParams = [epicId];

    if (filters?.phase_id) {
      query += ' AND s.phase_id = ?';
      queryParams.push(filters.phase_id);
    }

    if (filters?.status) {
      query += ' AND s.status = ?';
      queryParams.push(filters.status);
    }

    if (filters?.assignee_id) {
      query += ' AND s.assignee_id = ?';
      queryParams.push(filters.assignee_id);
    }

    query += ' ORDER BY s.sequence_order ASC, s.created_at ASC';

    return await this.db.query(query, queryParams);
  }

  async getEpicHierarchy(epicId: number): Promise<{
    epic: Epic;
    stories: Array<Story & {
      tasks: Array<Task & {
        subtasks: Subtask[];
      }>;
    }>;
  }> {
    const epic = await this.getEpicById(epicId);
    const stories = await this.getEpicStories(epicId);

    const storiesWithTasks = await Promise.all(
      stories.map(async (story) => {
        const tasks = await this.getStoryTasks(story.id);
        const tasksWithSubtasks = await Promise.all(
          tasks.map(async (task) => {
            const subtasks = await this.getTaskSubtasks(task.id);
            return { ...task, subtasks };
          })
        );
        return { ...story, tasks: tasksWithSubtasks };
      })
    );

    return {
      epic,
      stories: storiesWithTasks
    };
  }

  private async createStoriesFromTemplate(epicId: number, templateId: number, createdBy: number): Promise<void> {
    const template = await this.db.queryFirst(
      'SELECT configuration FROM template_versions WHERE template_id = ? ORDER BY version_number DESC LIMIT 1',
      [templateId]
    );

    if (!template || !template.configuration) {
      return;
    }

    const config = JSON.parse(template.configuration);
    
    if (config.predefined_stories) {
      for (const storyTemplate of config.predefined_stories) {
        const story = await this.createStory({
          epic_id: epicId,
          title: storyTemplate.title,
          description: storyTemplate.description,
          phase_id: storyTemplate.phase_id,
          priority: Priority.MEDIUM,
          estimated_hours: storyTemplate.estimated_hours,
          created_by: createdBy
        });

        // Create predefined tasks
        if (storyTemplate.predefined_tasks) {
          for (const taskTemplate of storyTemplate.predefined_tasks) {
            const task = await this.createTask({
              story_id: story.id,
              title: taskTemplate.title,
              description: taskTemplate.description,
              priority: Priority.MEDIUM,
              estimated_hours: taskTemplate.estimated_hours,
              created_by: createdBy
            });

            // Create predefined subtasks
            if (taskTemplate.predefined_subtasks) {
              for (const subtaskTemplate of taskTemplate.predefined_subtasks) {
                await this.createSubtask({
                  task_id: task.id,
                  title: subtaskTemplate.title,
                  description: subtaskTemplate.description,
                  priority: Priority.MEDIUM,
                  estimated_hours: subtaskTemplate.estimated_hours,
                  created_by: createdBy
                });
              }
            }
          }
        }
      }
    }
  }

  // Story Management
  async createStory(storyData: {
    epic_id: number;
    title: string;
    description?: string;
    phase_id: number;
    priority: Priority;
    assignee_id?: number;
    start_date?: Date;
    due_date?: Date;
    estimated_hours?: number;
    sequence_order?: number;
    created_by: number;
  }): Promise<Story> {
    const {
      epic_id,
      title,
      description,
      phase_id,
      priority,
      assignee_id,
      start_date,
      due_date,
      estimated_hours,
      sequence_order,
      created_by
    } = storyData;

    // Validate epic exists
    await this.getEpicById(epic_id);

    // Validate phase exists
    await this.phaseService.getPhaseById(phase_id);

    // If no sequence order provided, use next available
    let finalSequenceOrder = sequence_order;
    if (!finalSequenceOrder) {
      const maxSequence = await this.db.queryFirst(
        'SELECT COALESCE(MAX(sequence_order), 0) as max_order FROM stories WHERE epic_id = ?',
        [epic_id]
      );
      finalSequenceOrder = maxSequence.max_order + 1;
    }

    const query = `
      INSERT INTO stories (
        epic_id, title, description, phase_id, status, priority,
        assignee_id, start_date, due_date, estimated_hours, 
        sequence_order, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const result = await this.db.query(query, [
      epic_id, title, description, phase_id, Status.NOT_STARTED, priority,
      assignee_id, start_date, due_date, estimated_hours,
      finalSequenceOrder, created_by
    ]);

    return await this.getStoryById(result.insertId);
  }

  async getStoryById(id: number): Promise<Story> {
    const query = `
      SELECT 
        s.*,
        e.title as epic_title,
        p.name as phase_name,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name
      FROM stories s
      LEFT JOIN epics e ON s.epic_id = e.id
      LEFT JOIN phases p ON s.phase_id = p.id
      LEFT JOIN users assignee ON s.assignee_id = assignee.id
      WHERE s.id = ?
    `;

    const story = await this.db.queryFirst(query, [id]);

    if (!story) {
      throw new NotFoundError('Story', id);
    }

    return story;
  }

  async updateStory(id: number, updates: Partial<Story>): Promise<Story> {
    const existingStory = await this.getStoryById(id);

    const updateFields = [];
    const updateValues = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      return existingStory;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const query = `UPDATE stories SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.query(query, updateValues);

    // Update parent epic completion if story status changed
    if (updates.status || updates.completion_percentage !== undefined) {
      await this.updateEpicProgress(existingStory.epic_id);
    }

    return await this.getStoryById(id);
  }

  async getStoryTasks(storyId: number): Promise<Task[]> {
    const query = `
      SELECT 
        t.*,
        s.title as story_title,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name
      FROM tasks t
      LEFT JOIN stories s ON t.story_id = s.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      WHERE t.story_id = ?
      ORDER BY t.sequence_order ASC, t.created_at ASC
    `;

    return await this.db.query(query, [storyId]);
  }

  // Task Management
  async createTask(taskData: {
    story_id: number;
    title: string;
    description?: string;
    priority: Priority;
    assignee_id?: number;
    start_date?: Date;
    due_date?: Date;
    estimated_hours?: number;
    sequence_order?: number;
    created_by: number;
  }): Promise<Task> {
    const {
      story_id,
      title,
      description,
      priority,
      assignee_id,
      start_date,
      due_date,
      estimated_hours,
      sequence_order,
      created_by
    } = taskData;

    // Validate story exists
    await this.getStoryById(story_id);

    // If no sequence order provided, use next available
    let finalSequenceOrder = sequence_order;
    if (!finalSequenceOrder) {
      const maxSequence = await this.db.queryFirst(
        'SELECT COALESCE(MAX(sequence_order), 0) as max_order FROM tasks WHERE story_id = ?',
        [story_id]
      );
      finalSequenceOrder = maxSequence.max_order + 1;
    }

    const query = `
      INSERT INTO tasks (
        story_id, title, description, status, priority,
        assignee_id, start_date, due_date, estimated_hours,
        sequence_order, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const result = await this.db.query(query, [
      story_id, title, description, Status.NOT_STARTED, priority,
      assignee_id, start_date, due_date, estimated_hours,
      finalSequenceOrder, created_by
    ]);

    return await this.getTaskById(result.insertId);
  }

  async getTaskById(id: number): Promise<Task> {
    const query = `
      SELECT 
        t.*,
        s.title as story_title,
        s.epic_id,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name
      FROM tasks t
      LEFT JOIN stories s ON t.story_id = s.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      WHERE t.id = ?
    `;

    const task = await this.db.queryFirst(query, [id]);

    if (!task) {
      throw new NotFoundError('Task', id);
    }

    return task;
  }

  async updateTask(id: number, updates: Partial<Task>): Promise<Task> {
    const existingTask = await this.getTaskById(id);

    const updateFields = [];
    const updateValues = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      return existingTask;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const query = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.query(query, updateValues);

    // Update parent story completion if task status changed
    if (updates.status || updates.completion_percentage !== undefined) {
      await this.updateStoryProgress(existingTask.story_id);
    }

    return await this.getTaskById(id);
  }

  async getTaskSubtasks(taskId: number): Promise<Subtask[]> {
    const query = `
      SELECT 
        st.*,
        t.title as task_title,
        t.story_id,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name
      FROM subtasks st
      LEFT JOIN tasks t ON st.task_id = t.id
      LEFT JOIN users assignee ON st.assignee_id = assignee.id
      WHERE st.task_id = ?
      ORDER BY st.sequence_order ASC, st.created_at ASC
    `;

    return await this.db.query(query, [taskId]);
  }

  // Subtask Management
  async createSubtask(subtaskData: {
    task_id: number;
    title: string;
    description?: string;
    priority: Priority;
    assignee_id?: number;
    start_date?: Date;
    due_date?: Date;
    estimated_hours?: number;
    sequence_order?: number;
    created_by: number;
  }): Promise<Subtask> {
    const {
      task_id,
      title,
      description,
      priority,
      assignee_id,
      start_date,
      due_date,
      estimated_hours,
      sequence_order,
      created_by
    } = subtaskData;

    // Validate task exists
    await this.getTaskById(task_id);

    // If no sequence order provided, use next available
    let finalSequenceOrder = sequence_order;
    if (!finalSequenceOrder) {
      const maxSequence = await this.db.queryFirst(
        'SELECT COALESCE(MAX(sequence_order), 0) as max_order FROM subtasks WHERE task_id = ?',
        [task_id]
      );
      finalSequenceOrder = maxSequence.max_order + 1;
    }

    const query = `
      INSERT INTO subtasks (
        task_id, title, description, status, priority,
        assignee_id, start_date, due_date, estimated_hours,
        sequence_order, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const result = await this.db.query(query, [
      task_id, title, description, Status.NOT_STARTED, priority,
      assignee_id, start_date, due_date, estimated_hours,
      finalSequenceOrder, created_by
    ]);

    return await this.getSubtaskById(result.insertId);
  }

  async getSubtaskById(id: number): Promise<Subtask> {
    const query = `
      SELECT 
        st.*,
        t.title as task_title,
        t.story_id,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name
      FROM subtasks st
      LEFT JOIN tasks t ON st.task_id = t.id
      LEFT JOIN users assignee ON st.assignee_id = assignee.id
      WHERE st.id = ?
    `;

    const subtask = await this.db.queryFirst(query, [id]);

    if (!subtask) {
      throw new NotFoundError('Subtask', id);
    }

    return subtask;
  }

  async updateSubtask(id: number, updates: Partial<Subtask>): Promise<Subtask> {
    const existingSubtask = await this.getSubtaskById(id);

    const updateFields = [];
    const updateValues = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      return existingSubtask;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const query = `UPDATE subtasks SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.query(query, updateValues);

    // Update parent task completion if subtask status changed
    if (updates.status || updates.is_completed !== undefined) {
      await this.updateTaskProgress(existingSubtask.task_id);
    }

    return await this.getSubtaskById(id);
  }

  // Progress Calculation Methods
  private async updateTaskProgress(taskId: number): Promise<void> {
    const subtasks = await this.getTaskSubtasks(taskId);
    
    if (subtasks.length === 0) return;

    const completedSubtasks = subtasks.filter(st => st.is_completed || st.status === Status.COMPLETED).length;
    const completionPercentage = Math.round((completedSubtasks / subtasks.length) * 100);

    let newStatus = Status.NOT_STARTED;
    if (completionPercentage === 100) {
      newStatus = Status.COMPLETED;
    } else if (completionPercentage > 0) {
      newStatus = Status.IN_PROGRESS;
    }

    await this.db.query(
      'UPDATE tasks SET completion_percentage = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [completionPercentage, newStatus, taskId]
    );

    // Get the story_id to update story progress
    const task = await this.getTaskById(taskId);
    await this.updateStoryProgress(task.story_id);
  }

  private async updateStoryProgress(storyId: number): Promise<void> {
    const tasks = await this.getStoryTasks(storyId);
    
    if (tasks.length === 0) return;

    const totalCompletion = tasks.reduce((sum, task) => sum + (task.completion_percentage || 0), 0);
    const completionPercentage = Math.round(totalCompletion / tasks.length);

    let newStatus = Status.NOT_STARTED;
    if (completionPercentage === 100) {
      newStatus = Status.COMPLETED;
    } else if (completionPercentage > 0) {
      newStatus = Status.IN_PROGRESS;
    }

    await this.db.query(
      'UPDATE stories SET completion_percentage = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [completionPercentage, newStatus, storyId]
    );

    // Get the epic_id to update epic progress
    const story = await this.getStoryById(storyId);
    await this.updateEpicProgress(story.epic_id);
  }

  private async updateEpicProgress(epicId: number): Promise<void> {
    const stories = await this.getEpicStories(epicId);
    
    if (stories.length === 0) return;

    const totalCompletion = stories.reduce((sum, story) => sum + (story.completion_percentage || 0), 0);
    const completionPercentage = Math.round(totalCompletion / stories.length);

    let newStatus = Status.NOT_STARTED;
    if (completionPercentage === 100) {
      newStatus = Status.COMPLETED;
    } else if (completionPercentage > 0) {
      newStatus = Status.IN_PROGRESS;
    }

    // Don't update epic status to completed automatically - require manual phase completion
    const updateStatus = completionPercentage < 100 ? newStatus : undefined;

    if (updateStatus) {
      await this.db.query(
        'UPDATE epics SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [updateStatus, epicId]
      );
    }
  }

  // Bulk Operations
  async bulkUpdateStories(storyIds: number[], updates: Partial<Story>): Promise<Story[]> {
    if (storyIds.length === 0) return [];

    const updateFields = [];
    const updateValues = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      return await Promise.all(storyIds.map(id => this.getStoryById(id)));
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const placeholders = storyIds.map(() => '?').join(',');
    const query = `UPDATE stories SET ${updateFields.join(', ')} WHERE id IN (${placeholders})`;
    
    await this.db.query(query, [...updateValues, ...storyIds]);

    // Update epic progress for affected epics
    const affectedEpics = await this.db.query(
      `SELECT DISTINCT epic_id FROM stories WHERE id IN (${placeholders})`,
      storyIds
    );

    await Promise.all(
      affectedEpics.map((epic: { epic_id: number }) => this.updateEpicProgress(epic.epic_id))
    );

    return await Promise.all(storyIds.map(id => this.getStoryById(id)));
  }

  async reorderStories(epicId: number, storyOrders: { storyId: number; sequenceOrder: number }[]): Promise<void> {
    const transaction = await this.db.beginTransaction();

    try {
      for (const { storyId, sequenceOrder } of storyOrders) {
        await this.db.query(
          'UPDATE stories SET sequence_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND epic_id = ?',
          [sequenceOrder, storyId, epicId]
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async moveStoryToPhase(storyId: number, targetPhaseId: number): Promise<Story> {
    const story = await this.getStoryById(storyId);
    
    // Validate target phase
    await this.phaseService.getPhaseById(targetPhaseId);

    return await this.updateStory(storyId, {
      phase_id: targetPhaseId
    });
  }
}