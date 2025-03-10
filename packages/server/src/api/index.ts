import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import chatRoutes from './routes/chat';
import completionsRoutes from './routes/completions';
import embeddingsRoutes from './routes/embeddings';
import modelsRoutes from './routes/models';
import { createLogger } from '../utils/logger';

const logger = createLogger('api-router');
const router = express.Router();

// Apply authentication and rate limiting to all API routes
router.use(authMiddleware);
router.use(rateLimiter);

// Mount route handlers
router.use('/chat', chatRoutes);
router.use('/completions', completionsRoutes);
router.use('/embeddings', embeddingsRoutes);
router.use('/models', modelsRoutes);

// Log API requests
router.use((req, res, next) => {
  logger.info(`API request: ${req.method} ${req.originalUrl}`);
  next();
});

export const apiRouter = router;
