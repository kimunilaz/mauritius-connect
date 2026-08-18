import { Router } from 'express';
import healthRouter from './healthRoutes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);

export default apiRouter;
