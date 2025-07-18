import { Router } from 'express';
import { TemplateController } from '../controllers/template-controller';
import { TemplateService } from '../../modules/templates/template-service';
import { getDatabase } from '../../database/init';

const router = Router();

// Initialize services
const initServices = async () => {
  const db = await getDatabase();
  const templateService = new TemplateService(db as any);
  return new TemplateController(templateService);
};

// Get all templates
router.get('/', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.getAllTemplates(req, res);
  } catch (error) {
    next(error);
  }
});

// Create template
router.post('/', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.createTemplate(req, res);
  } catch (error) {
    next(error);
  }
});

// Get template by ID
router.get('/:id', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.getTemplate(req, res);
  } catch (error) {
    next(error);
  }
});

// Update template
router.put('/:id', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.updateTemplate(req, res);
  } catch (error) {
    next(error);
  }
});

// Delete template
router.delete('/:id', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.deleteTemplate(req, res);
  } catch (error) {
    next(error);
  }
});

// Duplicate template
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.duplicateTemplate(req, res);
  } catch (error) {
    next(error);
  }
});

// Apply template to epic
router.post('/:id/apply', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.applyTemplate(req, res);
  } catch (error) {
    next(error);
  }
});

// Get template versions
router.get('/:id/versions', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.getTemplateVersions(req, res);
  } catch (error) {
    next(error);
  }
});

// Create template version
router.post('/:id/versions', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.createTemplateVersion(req, res);
  } catch (error) {
    next(error);
  }
});

// Get template analytics
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const templateController = await initServices();
    await templateController.getTemplateAnalytics(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;