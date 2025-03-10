import express from 'express';
import { embeddingsHandler } from '../controllers/embeddings';
import { createLogger } from '../../utils/logger';

const logger = createLogger('embeddings-routes');
const router = express.Router();

// Embeddings endpoint
router.post('/', async (req, res, next) => {
  try {
    logger.debug('Received embeddings request', {
      model: req.body.model,
      input: Array.isArray(req.body.input) ? `${req.body.input.length} items` : 'single item',
    });

    return embeddingsHandler(req, res, next);
  } catch (error) {
    next(error);
  }
});

export default router;
