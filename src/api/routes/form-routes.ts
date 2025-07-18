import { Router } from 'express';
import { FormController } from '../controllers/form-controller';
import { FormBuilderService } from '../../modules/forms/form-builder-service';
import { getDatabase } from '../../database/init';

const router = Router();

// Initialize services
const initServices = async () => {
  const db = await getDatabase();
  const formBuilderService = new FormBuilderService(db as any);
  return new FormController(formBuilderService);
};

// Get all forms
router.get('/', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.getAllForms(req, res);
  } catch (error) {
    next(error);
  }
});

// Create form
router.post('/', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.createForm(req, res);
  } catch (error) {
    next(error);
  }
});

// Get form by ID
router.get('/:id', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.getForm(req, res);
  } catch (error) {
    next(error);
  }
});

// Update form
router.put('/:id', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.updateForm(req, res);
  } catch (error) {
    next(error);
  }
});

// Delete form
router.delete('/:id', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.deleteForm(req, res);
  } catch (error) {
    next(error);
  }
});

// Duplicate form
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.duplicateForm(req, res);
  } catch (error) {
    next(error);
  }
});

// Submit form
router.post('/:id/submit', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.submitForm(req, res);
  } catch (error) {
    next(error);
  }
});

// Get form submissions
router.get('/:id/submissions', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.getFormSubmissions(req, res);
  } catch (error) {
    next(error);
  }
});

// Get submission by ID
router.get('/:id/submissions/:submissionId', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.getSubmission(req, res);
  } catch (error) {
    next(error);
  }
});

// Get entity submissions
router.get('/entity/:entity_type/:entity_id', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.getEntitySubmissions(req, res);
  } catch (error) {
    next(error);
  }
});

// Get form analytics
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const formController = await initServices();
    await formController.getFormAnalytics(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;