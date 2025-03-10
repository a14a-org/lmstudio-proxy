import express from 'express';
import { completionHandler, completionStreamHandler } from '../controllers/completions';
import { createLogger } from '../../utils/logger';

const logger = createLogger('completions-routes');
const router = express.Router();

// Text completions endpoint (streaming and non-streaming)
router.post('/', async (req, res, next) => {
  try {
    logger.debug('Received text completion request', {
      model: req.body.model,
      stream: req.body.stream === true,
    });

    // Check if streaming is requested
    const stream = req.body.stream === true;

    if (stream) {
      // Handle streaming response
      return completionStreamHandler(req, res, next);
    } else {
      // Handle non-streaming response
      return completionHandler(req, res, next);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
