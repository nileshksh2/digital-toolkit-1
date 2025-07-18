import { Request, Response } from 'express';
import { EpicService } from '../../modules/epic-management/epic-service';
import { ApiResponse, CreateEpicRequest, UpdateEpicRequest, CreateStoryRequest, UpdateStoryRequest, CreateTaskRequest, UpdateTaskRequest, CreateSubtaskRequest, UpdateSubtaskRequest, BulkUpdateRequest } from '../../shared/types';
import { ValidationError, NotFoundError, ApplicationError } from '../../shared/types';
import { validateRequest } from '../../shared/utils/validation';

export class EpicController {
  constructor(private epicService: EpicService) {}

  async createEpic(req: Request, res: Response): Promise<void> {
    try {
      const epicData: CreateEpicRequest = req.body;
      const createdBy = (req as any).user.id;

      const epic = await this.epicService.createEpic({
        ...epicData,
        created_by: createdBy
      });

      const response: ApiResponse = {
        success: true,
        data: epic,
        message: 'Epic created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getEpic(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.id);
      const includeHierarchy = req.query.include_hierarchy === 'true';

      let data;
      if (includeHierarchy) {
        data = await this.epicService.getEpicHierarchy(epicId);
      } else {
        data = await this.epicService.getEpicById(epicId);
      }

      const response: ApiResponse = {
        success: true,
        data
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updateEpic(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.id);
      const updates: UpdateEpicRequest = req.body;

      const epic = await this.epicService.updateEpic(epicId, updates);

      const response: ApiResponse = {
        success: true,
        data: epic,
        message: 'Epic updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async deleteEpic(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.id);

      await this.epicService.deleteEpic(epicId);

      const response: ApiResponse = {
        success: true,
        message: 'Epic deleted successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getEpicStories(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.id);
      const filters = {
        phase_id: req.query.phase_id ? parseInt(req.query.phase_id as string) : undefined,
        status: req.query.status as any,
        assignee_id: req.query.assignee_id ? parseInt(req.query.assignee_id as string) : undefined
      };

      const stories = await this.epicService.getEpicStories(epicId, filters);

      const response: ApiResponse = {
        success: true,
        data: stories
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Story Management
  async createStory(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.epicId);
      const storyData: CreateStoryRequest = req.body;
      const createdBy = (req as any).user.id;

      const story = await this.epicService.createStory({
        ...storyData,
        epic_id: epicId,
        created_by: createdBy
      });

      const response: ApiResponse = {
        success: true,
        data: story,
        message: 'Story created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getStory(req: Request, res: Response): Promise<void> {
    try {
      const storyId = parseInt(req.params.id);
      const includeTasks = req.query.include_tasks === 'true';

      let data;
      if (includeTasks) {
        const story = await this.epicService.getStoryById(storyId);
        const tasks = await this.epicService.getStoryTasks(storyId);
        
        const tasksWithSubtasks = await Promise.all(
          tasks.map(async (task) => {
            const subtasks = await this.epicService.getTaskSubtasks(task.id);
            return { ...task, subtasks };
          })
        );

        data = { ...story, tasks: tasksWithSubtasks };
      } else {
        data = await this.epicService.getStoryById(storyId);
      }

      const response: ApiResponse = {
        success: true,
        data
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updateStory(req: Request, res: Response): Promise<void> {
    try {
      const storyId = parseInt(req.params.id);
      const updates: UpdateStoryRequest = req.body;

      const story = await this.epicService.updateStory(storyId, updates);

      const response: ApiResponse = {
        success: true,
        data: story,
        message: 'Story updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async bulkUpdateStories(req: Request, res: Response): Promise<void> {
    try {
      const bulkUpdate: BulkUpdateRequest = req.body;

      const stories = await this.epicService.bulkUpdateStories(
        bulkUpdate.story_ids,
        bulkUpdate.updates
      );

      const response: ApiResponse = {
        success: true,
        data: stories,
        message: `${stories.length} stories updated successfully`
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async reorderStories(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.epicId);
      const { story_orders } = req.body;

      await this.epicService.reorderStories(epicId, story_orders);

      const response: ApiResponse = {
        success: true,
        message: 'Stories reordered successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async moveStoryToPhase(req: Request, res: Response): Promise<void> {
    try {
      const storyId = parseInt(req.params.id);
      const { target_phase_id } = req.body;

      const story = await this.epicService.moveStoryToPhase(storyId, target_phase_id);

      const response: ApiResponse = {
        success: true,
        data: story,
        message: 'Story moved to new phase successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Task Management
  async createTask(req: Request, res: Response): Promise<void> {
    try {
      const storyId = parseInt(req.params.storyId);
      const taskData: CreateTaskRequest = req.body;
      const createdBy = (req as any).user.id;

      const task = await this.epicService.createTask({
        ...taskData,
        story_id: storyId,
        created_by: createdBy
      });

      const response: ApiResponse = {
        success: true,
        data: task,
        message: 'Task created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getTask(req: Request, res: Response): Promise<void> {
    try {
      const taskId = parseInt(req.params.id);
      const includeSubtasks = req.query.include_subtasks === 'true';

      let data;
      if (includeSubtasks) {
        const task = await this.epicService.getTaskById(taskId);
        const subtasks = await this.epicService.getTaskSubtasks(taskId);
        data = { ...task, subtasks };
      } else {
        data = await this.epicService.getTaskById(taskId);
      }

      const response: ApiResponse = {
        success: true,
        data
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updateTask(req: Request, res: Response): Promise<void> {
    try {
      const taskId = parseInt(req.params.id);
      const updates: UpdateTaskRequest = req.body;

      const task = await this.epicService.updateTask(taskId, updates);

      const response: ApiResponse = {
        success: true,
        data: task,
        message: 'Task updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getStoryTasks(req: Request, res: Response): Promise<void> {
    try {
      const storyId = parseInt(req.params.storyId);

      const tasks = await this.epicService.getStoryTasks(storyId);

      const response: ApiResponse = {
        success: true,
        data: tasks
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Subtask Management
  async createSubtask(req: Request, res: Response): Promise<void> {
    try {
      const taskId = parseInt(req.params.taskId);
      const subtaskData: CreateSubtaskRequest = req.body;
      const createdBy = (req as any).user.id;

      const subtask = await this.epicService.createSubtask({
        ...subtaskData,
        task_id: taskId,
        created_by: createdBy
      });

      const response: ApiResponse = {
        success: true,
        data: subtask,
        message: 'Subtask created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getSubtask(req: Request, res: Response): Promise<void> {
    try {
      const subtaskId = parseInt(req.params.id);

      const subtask = await this.epicService.getSubtaskById(subtaskId);

      const response: ApiResponse = {
        success: true,
        data: subtask
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updateSubtask(req: Request, res: Response): Promise<void> {
    try {
      const subtaskId = parseInt(req.params.id);
      const updates: UpdateSubtaskRequest = req.body;

      const subtask = await this.epicService.updateSubtask(subtaskId, updates);

      const response: ApiResponse = {
        success: true,
        data: subtask,
        message: 'Subtask updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getTaskSubtasks(req: Request, res: Response): Promise<void> {
    try {
      const taskId = parseInt(req.params.taskId);

      const subtasks = await this.epicService.getTaskSubtasks(taskId);

      const response: ApiResponse = {
        success: true,
        data: subtasks
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private handleError(res: Response, error: any): void {
    console.error('Epic Controller Error:', error);

    if (error instanceof ValidationError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
      };
      res.status(400).json(response);
    } else if (error instanceof NotFoundError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
      };
      res.status(404).json(response);
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