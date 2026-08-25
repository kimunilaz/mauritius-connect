import { Router } from 'express';
import multer from 'multer';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateRequest } from '../validators/validateRequest.js';
import {
  verificationCreateSchema,
  verificationListQuerySchema,
  verificationParamsSchema,
  verificationRejectSchema,
} from '../validators/verificationValidators.js';
import { verificationService as defaultService } from '../services/verificationService.js';
import { authService as defaultAuth } from '../services/authService.js';
import { createVerificationController } from '../controllers/verificationController.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, parts: 2 },
});
function base(auth, role) {
  const r = Router();
  r.use(
    createAuthenticateUser(auth),
    createLoadApplicationProfile(auth),
    requireActiveAccount,
    requireRole(role),
  );
  return r;
}
export function createVerificationRouter(
  auth = defaultAuth,
  service = defaultService,
) {
  const r = base(auth, 'LANDLORD'),
    c = createVerificationController(service);
  r.post('/', validateRequest(verificationCreateSchema), c.create);
  r.get('/', validateRequest(verificationListQuerySchema, 'query'), c.list);
  r.get(
    '/:verificationId',
    validateRequest(verificationParamsSchema, 'params'),
    c.detail,
  );
  r.post(
    '/:verificationId/evidence',
    validateRequest(verificationParamsSchema, 'params'),
    upload.single('evidence'),
    c.evidence,
  );
  r.get(
    '/:verificationId/evidence',
    validateRequest(verificationParamsSchema, 'params'),
    c.evidenceUrl,
  );
  return r;
}
export function createAdminVerificationRouter(
  auth = defaultAuth,
  service = defaultService,
) {
  const r = base(auth, 'ADMIN'),
    c = createVerificationController(service);
  r.use((req, _res, next) => {
    req.isAdmin = true;
    next();
  });
  r.get(
    '/',
    validateRequest(verificationListQuerySchema, 'query'),
    (req, res) => {
      req.validatedQuery = { ...req.validatedQuery, admin: true };
      return c.list(req, res);
    },
  );
  r.get(
    '/:verificationId',
    validateRequest(verificationParamsSchema, 'params'),
    c.detail,
  );
  r.get(
    '/:verificationId/evidence',
    validateRequest(verificationParamsSchema, 'params'),
    c.evidenceUrl,
  );
  r.post(
    '/:verificationId/review',
    validateRequest(verificationParamsSchema, 'params'),
    validateRequest(verificationRejectSchema),
    c.review,
  );
  r.post(
    '/:verificationId/approve',
    validateRequest(verificationParamsSchema, 'params'),
    c.approve,
  );
  r.post(
    '/:verificationId/reject',
    validateRequest(verificationParamsSchema, 'params'),
    validateRequest(verificationRejectSchema),
    c.reject,
  );
  return r;
}
