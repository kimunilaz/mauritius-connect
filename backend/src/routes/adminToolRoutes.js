import { Router } from 'express';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuth } from '../services/authService.js';
import { validateRequest } from '../validators/validateRequest.js';
import {
  adminPage,
  adminId,
  returnReason,
} from '../validators/adminValidators.js';
import { adminController as c } from '../controllers/adminController.js';
export function createAdminToolRouter(auth = defaultAuth) {
  const r = Router();
  r.use(
    createAuthenticateUser(auth),
    createLoadApplicationProfile(auth),
    requireActiveAccount,
    requireRole('ADMIN'),
  );
  r.get('/listings', validateRequest(adminPage, 'query'), c.listings);
  r.get('/listings/:id', validateRequest(adminId, 'params'), c.listing);
  r.post(
    '/listings/:id/approve',
    validateRequest(adminId, 'params'),
    c.approve,
  );
  r.post(
    '/listings/:id/return-to-draft',
    validateRequest(adminId, 'params'),
    validateRequest(returnReason),
    c.returnDraft,
  );
  r.get('/users', validateRequest(adminPage, 'query'), c.users);
  r.get('/users/:id', validateRequest(adminId, 'params'), c.user);
  r.post('/users/:id/suspend', validateRequest(adminId, 'params'), c.suspend);
  r.post(
    '/users/:id/reactivate',
    validateRequest(adminId, 'params'),
    c.reactivate,
  );
  return r;
}
