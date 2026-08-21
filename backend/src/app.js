import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createApiRouter } from './routes/index.js';

export function createApp({ authService, profileService } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);

  app.use('/api/v1', createApiRouter({ authService, profileService }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
