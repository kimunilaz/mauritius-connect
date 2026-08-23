import { Router } from 'express';
import { createApplicationController } from '../controllers/applicationController.js';
import { createApplicationAnswerController } from '../controllers/applicationAnswerController.js';
import { createApplicationSubmissionController } from '../controllers/applicationSubmissionController.js';
import { createApplicationTransitionController } from '../controllers/applicationTransitionController.js';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { applicationService as defaultApplicationService } from '../services/applicationService.js';
import { applicationAnswerService as defaultApplicationAnswerService } from '../services/applicationAnswerService.js';
import { applicationSubmissionService as defaultApplicationSubmissionService } from '../services/applicationSubmissionService.js';
import { applicationTransitionService as defaultApplicationTransitionService } from '../services/applicationTransitionService.js';
import { authService as defaultAuthService } from '../services/authService.js';
import {
  applicationListingParamsSchema,
  applicationParamsSchema,
  createApplicationDraftSchema,
  tenantApplicationListQuerySchema,
  updateApplicationDraftSchema,
} from '../validators/applicationValidators.js';
import { validateRequest } from '../validators/validateRequest.js';
import { putApplicationAnswersSchema } from '../validators/applicationAnswerValidators.js';

function tenantMiddleware(authService) {
  return [
    createAuthenticateUser(authService),
    createLoadApplicationProfile(authService),
    requireActiveAccount,
    requireRole('TENANT'),
  ];
}

export function createTenantApplicationRouter(
  authService = defaultAuthService,
  service = defaultApplicationService,
) {
  const router = Router();
  const controller = createApplicationController(service);
  router.get(
    '/',
    ...tenantMiddleware(authService),
    validateRequest(tenantApplicationListQuerySchema, 'query'),
    controller.list,
  );
  return router;
}

export function createListingApplicationRouter(
  authService = defaultAuthService,
  service = defaultApplicationService,
) {
  const router = Router();
  const controller = createApplicationController(service);
  router.post(
    '/:listingId/applications',
    ...tenantMiddleware(authService),
    validateRequest(applicationListingParamsSchema, 'params'),
    validateRequest(createApplicationDraftSchema),
    controller.create,
  );
  return router;
}

export function createApplicationRouter(
  authService = defaultAuthService,
  service = defaultApplicationService,
  answerService = defaultApplicationAnswerService,
  submissionService = defaultApplicationSubmissionService,
  transitionService = defaultApplicationTransitionService,
) {
  const router = Router();
  const controller = createApplicationController(service);
  const answerController = createApplicationAnswerController(answerService);
  const submissionController =
    createApplicationSubmissionController(submissionService);
  const transitionController =
    createApplicationTransitionController(transitionService);
  router.post(
    '/:applicationId/withdraw',
    ...tenantMiddleware(authService),
    validateRequest(applicationParamsSchema, 'params'),
    transitionController.withdraw,
  );
  router.post(
    '/:applicationId/submit',
    ...tenantMiddleware(authService),
    validateRequest(applicationParamsSchema, 'params'),
    submissionController.submit,
  );
  router.get(
    '/:applicationId/answers',
    ...tenantMiddleware(authService),
    validateRequest(applicationParamsSchema, 'params'),
    answerController.list,
  );
  router.put(
    '/:applicationId/answers',
    ...tenantMiddleware(authService),
    validateRequest(applicationParamsSchema, 'params'),
    validateRequest(putApplicationAnswersSchema),
    answerController.put,
  );
  router.get(
    '/:applicationId',
    ...tenantMiddleware(authService),
    validateRequest(applicationParamsSchema, 'params'),
    controller.get,
  );
  router.patch(
    '/:applicationId',
    ...tenantMiddleware(authService),
    validateRequest(applicationParamsSchema, 'params'),
    validateRequest(updateApplicationDraftSchema),
    controller.update,
  );
  return router;
}
