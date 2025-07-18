import { Router } from 'express';
import { EpicController } from '../controllers/epic-controller';
import { authenticateToken } from '../middleware/auth-middleware';
import { validatePermissions } from '../middleware/permissions-middleware';

export function createEpicRoutes(epicController: EpicController): Router {
  const router = Router();

  // Apply authentication middleware to all routes
  router.use(authenticateToken);

  // Epic Management Routes
  router.post('/', 
    validatePermissions(['can_create_epics']),
    epicController.createEpic.bind(epicController)
  );

  router.get('/:id',
    validatePermissions(['can_view_epics']),
    epicController.getEpic.bind(epicController)
  );

  router.put('/:id',
    validatePermissions(['can_edit_epics']),
    epicController.updateEpic.bind(epicController)
  );

  router.delete('/:id',
    validatePermissions(['can_delete_epics']),
    epicController.deleteEpic.bind(epicController)
  );

  router.get('/:id/stories',
    validatePermissions(['can_view_epics']),
    epicController.getEpicStories.bind(epicController)
  );

  // Story Management Routes
  router.post('/:epicId/stories',
    validatePermissions(['can_create_stories']),
    epicController.createStory.bind(epicController)
  );

  router.get('/stories/:id',
    validatePermissions(['can_view_stories']),
    epicController.getStory.bind(epicController)
  );

  router.put('/stories/:id',
    validatePermissions(['can_edit_stories']),
    epicController.updateStory.bind(epicController)
  );

  router.post('/stories/bulk-update',
    validatePermissions(['can_edit_stories']),
    epicController.bulkUpdateStories.bind(epicController)
  );

  router.put('/:epicId/stories/reorder',
    validatePermissions(['can_edit_stories']),
    epicController.reorderStories.bind(epicController)
  );

  router.put('/stories/:id/move-to-phase',
    validatePermissions(['can_edit_stories']),
    epicController.moveStoryToPhase.bind(epicController)
  );

  // Task Management Routes
  router.post('/stories/:storyId/tasks',
    validatePermissions(['can_create_tasks']),
    epicController.createTask.bind(epicController)
  );

  router.get('/stories/:storyId/tasks',
    validatePermissions(['can_view_tasks']),
    epicController.getStoryTasks.bind(epicController)
  );

  router.get('/tasks/:id',
    validatePermissions(['can_view_tasks']),
    epicController.getTask.bind(epicController)
  );

  router.put('/tasks/:id',
    validatePermissions(['can_edit_tasks']),
    epicController.updateTask.bind(epicController)
  );

  // Subtask Management Routes
  router.post('/tasks/:taskId/subtasks',
    validatePermissions(['can_create_subtasks']),
    epicController.createSubtask.bind(epicController)
  );

  router.get('/tasks/:taskId/subtasks',
    validatePermissions(['can_view_subtasks']),
    epicController.getTaskSubtasks.bind(epicController)
  );

  router.get('/subtasks/:id',
    validatePermissions(['can_view_subtasks']),
    epicController.getSubtask.bind(epicController)
  );

  router.put('/subtasks/:id',
    validatePermissions(['can_edit_subtasks']),
    epicController.updateSubtask.bind(epicController)
  );

  return router;
}