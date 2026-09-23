import { Router } from 'express';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuth } from '../services/authService.js';
import { overviewRepository } from '../repositories/overviewRepository.js';

export function createOverviewRouter(
  auth = defaultAuth,
  repository = overviewRepository,
) {
  const router = Router();
  router.use(
    createAuthenticateUser(auth),
    createLoadApplicationProfile(auth),
    requireActiveAccount,
  );
  router.get(
    '/landlord',
    requireRole('LANDLORD', 'AGENT'),
    async (req, res, next) => {
      try {
        res.json({
          success: true,
          data: await repository.landlord(req.auth.userId),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/admin', requireRole('ADMIN'), async (_req, res, next) => {
    try {
      res.json({ success: true, data: await repository.admin() });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
