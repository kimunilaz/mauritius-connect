import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createApiRouter } from './routes/index.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { env } from './config/env.js';

const sensitiveRateLimiter = createRateLimiter({
  limit: env.nodeEnv === 'test' ? 10000 : env.rateLimitSensitive,
});

export function createApp({
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
  messageService,
  notificationService,
  reportService,
  verificationService,
  applicationAcceptanceService,
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(
    '/api/v1',
    createRateLimiter({
      limit: env.nodeEnv === 'test' ? 10000 : env.rateLimitGlobal,
    }),
  );
  app.use('/api/v1', (request, response, next) => {
    const highRisk =
      /\/messages|\/reports$|\/conversation$|\/applications$|\/submit$|\/evidence$|\/images$|\/publish$|\/admin\//.test(
        request.path,
      ) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    return highRisk ? sensitiveRateLimiter(request, response, next) : next();
  });
  app.use('/api/v1', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);

  app.use(
    '/api/v1',
    createApiRouter({
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
      messageService,
      notificationService,
      reportService,
      verificationService,
      applicationAcceptanceService,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
