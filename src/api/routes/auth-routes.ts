import { Router } from 'express';
import { AuthController } from '../controllers/auth-controller';
import { AuthService } from '../../modules/access-control/auth-service';
import { getDatabase } from '../../database/init';

const router = Router();

// Initialize services
const initServices = async () => {
  const db = await getDatabase();
  const authService = new AuthService(db as any);
  return new AuthController(authService);
};

// Login endpoint
router.post('/login', async (req, res, next) => {
  try {
    const authController = await initServices();
    await authController.login(req, res);
  } catch (error) {
    next(error);
  }
});

// Logout endpoint
router.post('/logout', async (req, res, next) => {
  try {
    const authController = await initServices();
    await authController.logout(req, res);
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', async (req, res, next) => {
  try {
    const authController = await initServices();
    await authController.getCurrentUser(req, res);
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const authController = await initServices();
    await authController.refreshToken(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;