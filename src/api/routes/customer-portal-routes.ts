import { Router } from 'express';
import multer from 'multer';
import { CustomerPortalController } from '../controllers/customer-portal-controller';
import { CustomerPortalService } from '../../modules/customer-portal/customer-portal-service';
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
  const customerPortalService = new CustomerPortalService(db as any);
  return new CustomerPortalController(customerPortalService);
};

// Public routes (no authentication required)

// Validate portal key
router.get('/:portalKey/validate', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.validatePortalKey(req, res);
  } catch (error) {
    next(error);
  }
});

// Get portal data
router.get('/:portalKey', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.getPortalData(req, res);
  } catch (error) {
    next(error);
  }
});

// Submit customer comment
router.post('/:portalKey/comments', upload.array('attachments', 5), async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.submitComment(req, res);
  } catch (error) {
    next(error);
  }
});

// Get portal comments
router.get('/:portalKey/comments', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.getComments(req, res);
  } catch (error) {
    next(error);
  }
});

// Generate report
router.get('/:portalKey/report', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.generateReport(req, res);
  } catch (error) {
    next(error);
  }
});

// Get portal progress
router.get('/:portalKey/progress', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.getPortalProgress(req, res);
  } catch (error) {
    next(error);
  }
});

// Get portal stories
router.get('/:portalKey/stories', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.getPortalStories(req, res);
  } catch (error) {
    next(error);
  }
});

// Get recent updates
router.get('/:portalKey/updates', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.getRecentUpdates(req, res);
  } catch (error) {
    next(error);
  }
});

// Protected routes (require authentication)

// Create portal URL
router.post('/', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.createPortalUrl(req, res);
  } catch (error) {
    next(error);
  }
});

// Update portal settings
router.put('/settings', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.updatePortalSettings(req, res);
  } catch (error) {
    next(error);
  }
});

// Get portal settings
router.get('/settings/:customerId/:epicId', async (req, res, next) => {
  try {
    const customerPortalController = await initServices();
    await customerPortalController.getPortalSettings(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;