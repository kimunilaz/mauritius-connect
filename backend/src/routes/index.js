import { Router } from 'express';
import { createAuthRouter } from './authRoutes.js';
import healthRouter from './healthRoutes.js';
import {
  createBaseProfileRouter,
  createLandlordRouter,
  createTenantRouter,
} from './profileRoutes.js';
import {
  createLandlordPropertyRouter,
  createPropertyRouter,
} from './propertyRoutes.js';
import {
  createLandlordListingRouter,
  createListingRouter,
} from './listingRoutes.js';
import { createPublicListingRouter } from './publicListingRoutes.js';
import {
  createSavedListingActionRouter,
  createTenantSavedListingRouter,
} from './savedListingRoutes.js';
import {
  createApplicationQuestionActionRouter,
  createLandlordApplicationQuestionRouter,
  createPublicApplicationQuestionRouter,
} from './applicationQuestionRoutes.js';
import {
  createApplicationRouter,
  createListingApplicationRouter,
  createTenantApplicationRouter,
} from './applicationRoutes.js';
import {
  createLandlordApplicationRouter,
  createLandlordListingApplicationRouter,
} from './landlordApplicationRoutes.js';
import {
  createApplicationViewingRouter,
  createViewingRouter,
} from './viewingRoutes.js';
import {
  createConversationRouter,
  createListingConversationRouter,
} from './conversationRoutes.js';

export function createApiRouter({
  authService,
  profileService,
  propertyService,
  propertyImageService,
  listingService,
  publicListingService,
  savedListingService,
  applicationQuestionService,
  applicationService,
  applicationAnswerService,
  applicationSubmissionService,
  landlordApplicationService,
  applicationTransitionService,
  viewingService,
  conversationService,
} = {}) {
  const apiRouter = Router();

  apiRouter.use('/health', healthRouter);
  apiRouter.use('/auth', createAuthRouter(authService));
  apiRouter.use(
    '/profile',
    createBaseProfileRouter(authService, profileService),
  );
  apiRouter.use(
    '/tenant/saved-listings',
    createTenantSavedListingRouter(authService, savedListingService),
  );
  apiRouter.use(
    '/tenant/applications',
    createTenantApplicationRouter(authService, applicationService),
  );
  apiRouter.use('/tenant', createTenantRouter(authService, profileService));
  apiRouter.use('/landlord', createLandlordRouter(authService, profileService));
  apiRouter.use(
    '/landlord/properties',
    createLandlordPropertyRouter(authService, propertyService),
  );
  apiRouter.use(
    '/landlord/listings',
    createLandlordListingApplicationRouter(
      authService,
      landlordApplicationService,
    ),
  );
  apiRouter.use(
    '/landlord/applications',
    createLandlordApplicationRouter(
      authService,
      landlordApplicationService,
      applicationTransitionService,
      viewingService,
    ),
  );
  apiRouter.use(
    '/landlord/listings',
    createLandlordApplicationQuestionRouter(
      authService,
      applicationQuestionService,
    ),
  );
  apiRouter.use(
    '/landlord/listings',
    createLandlordListingRouter(authService, listingService),
  );
  apiRouter.use(
    '/properties',
    createPropertyRouter(authService, propertyService, propertyImageService),
  );
  apiRouter.use('/listings', createPublicListingRouter(publicListingService));
  apiRouter.use(
    '/listings',
    createListingConversationRouter(authService, conversationService),
  );
  apiRouter.use(
    '/listings',
    createPublicApplicationQuestionRouter(applicationQuestionService),
  );
  apiRouter.use(
    '/listings',
    createApplicationQuestionActionRouter(
      authService,
      applicationQuestionService,
    ),
  );
  apiRouter.use(
    '/listings',
    createListingApplicationRouter(authService, applicationService),
  );
  apiRouter.use(
    '/listings',
    createSavedListingActionRouter(authService, savedListingService),
  );
  apiRouter.use('/listings', createListingRouter(authService, listingService));
  apiRouter.use(
    '/applications',
    createApplicationViewingRouter(authService, viewingService),
  );
  apiRouter.use(
    '/applications',
    createApplicationRouter(
      authService,
      applicationService,
      applicationAnswerService,
      applicationSubmissionService,
      applicationTransitionService,
    ),
  );
  apiRouter.use('/viewings', createViewingRouter(authService, viewingService));
  apiRouter.use(
    '/conversations',
    createConversationRouter(authService, conversationService),
  );

  return apiRouter;
}

export default createApiRouter();
