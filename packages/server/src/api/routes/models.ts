import express from 'express';
import { listModelsHandler } from '../controllers/models';
import { createLogger } from '../../utils/logger';

const logger = createLogger('models-routes');
const router = express.Router();

// List models endpoint
router.get('/', async (req, res, next) => {
  try {
    logger.debug('Received list models request');
    return listModelsHandler(req, res, next);
  } catch (error) {
    next(error);
  }
});

export default router;
