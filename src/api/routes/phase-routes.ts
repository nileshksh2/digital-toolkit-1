import { Router } from 'express';
import { PhaseController } from '../controllers/phase-controller';
import { PhaseService } from '../../modules/phase-tracking/phase-service';
import { getDatabase } from '../../database/init';

const router = Router();

// Initialize services
const initServices = async () => {
  const db = await getDatabase();
  const phaseService = new PhaseService(db as any);
  return new PhaseController(phaseService);
};

// Get all phases
router.get('/', async (req, res, next) => {
  try {
    const phaseController = await initServices();
    await phaseController.getAllPhases(req, res);
  } catch (error) {
    next(error);
  }
});

// Get epic phases
router.get('/epic/:epicId', async (req, res, next) => {
  try {
    const phaseController = await initServices();
    await phaseController.getEpicPhases(req, res);
  } catch (error) {
    next(error);
  }
});

// Get current phase
router.get('/epic/:epicId/current', async (req, res, next) => {
  try {
    const phaseController = await initServices();
    await phaseController.getCurrentPhase(req, res);
  } catch (error) {
    next(error);
  }
});

// Transition to next phase
router.post('/transition', async (req, res, next) => {
  try {
    const phaseController = await initServices();
    await phaseController.transitionToNextPhase(req, res);
  } catch (error) {
    next(error);
  }
});

// Update phase progress
router.put('/epic/:epicId/phase/:phaseId/progress', async (req, res, next) => {
  try {
    const phaseController = await initServices();
    await phaseController.updatePhaseProgress(req, res);
  } catch (error) {
    next(error);
  }
});

// Get phase timeline
router.get('/epic/:epicId/timeline', async (req, res, next) => {
  try {
    const phaseController = await initServices();
    await phaseController.getPhaseTimeline(req, res);
  } catch (error) {
    next(error);
  }
});

// Get phase analytics
router.get('/epic/:epicId/analytics', async (req, res, next) => {
  try {
    const phaseController = await initServices();
    await phaseController.getPhaseAnalytics(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;