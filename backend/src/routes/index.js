import { Router } from 'express';
import { createAuthRouter } from './authRoutes.js';
import healthRouter from './healthRoutes.js';
import {
  createBaseProfileRouter,
  createLandlordRouter,
  createTenantRouter,
} from './profileRoutes.js';

export function createApiRouter({ authService, profileService } = {}) {
  const apiRouter = Router();

  apiRouter.use('/health', healthRouter);
  apiRouter.use('/auth', createAuthRouter(authService));
  apiRouter.use(
    '/profile',
    createBaseProfileRouter(authService, profileService),
  );
  apiRouter.use('/tenant', createTenantRouter(authService, profileService));
  apiRouter.use('/landlord', createLandlordRouter(authService, profileService));

  return apiRouter;
}

export default createApiRouter();
