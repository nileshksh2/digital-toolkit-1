import { Router } from 'express';
import multer from 'multer';
import { CommentController } from '../controllers/comment-controller';
import { CommentService } from '../../modules/comments/comment-service';
import { getDatabase } from '../../database/init';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: process.env.UPLOAD_DESTINATION || './uploads',
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '10485760') // 10MB
  }
});

// Initialize services
const initServices = async () => {
  const db = await getDatabase();
  const commentService = new CommentService(db as any);
  return new CommentController(commentService);
};

// Create comment
router.post('/', upload.array('attachments', 5), async (req, res, next) => {
  try {
    const commentController = await initServices();
    await commentController.createComment(req, res);
  } catch (error) {
    next(error);
  }
});

// Get comment by ID
router.get('/:id', async (req, res, next) => {
  try {
    const commentController = await initServices();
    await commentController.getComment(req, res);
  } catch (error) {
    next(error);
  }
});

// Update comment
router.put('/:id', async (req, res, next) => {
  try {
    const commentController = await initServices();
    await commentController.updateComment(req, res);
  } catch (error) {
    next(error);
  }
});

// Delete comment
router.delete('/:id', async (req, res, next) => {
  try {
    const commentController = await initServices();
    await commentController.deleteComment(req, res);
  } catch (error) {
    next(error);
  }
});

// Get comments by entity
router.get('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    const commentController = await initServices();
    await commentController.getCommentsByEntity(req, res);
  } catch (error) {
    next(error);
  }
});

// Get comment thread
router.get('/:id/thread', async (req, res, next) => {
  try {
    const commentController = await initServices();
    await commentController.getCommentThread(req, res);
  } catch (error) {
    next(error);
  }
});

// Mark comment as read
router.post('/:id/read', async (req, res, next) => {
  try {
    const commentController = await initServices();
    await commentController.markCommentAsRead(req, res);
  } catch (error) {
    next(error);
  }
});

// Get unread count
router.get('/unread/count', async (req, res, next) => {
  try {
    const commentController = await initServices();
    await commentController.getUnreadCount(req, res);
  } catch (error) {
    next(error);
  }
});

// Get recent activity
router.get('/recent/activity', async (req, res, next) => {
  try {
    const commentController = await initServices();
    await commentController.getRecentActivity(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;