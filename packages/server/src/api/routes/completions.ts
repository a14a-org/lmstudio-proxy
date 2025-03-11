import express from 'express';
import { completionHandler, completionStreamHandler } from '../controllers/completions';
import { createLogger } from '../../utils/logger';
import { config } from '../../config';

const logger = createLogger('completions-routes');
const router = express.Router();

// Text completions endpoint (streaming and non-streaming)
router.post('/', async (req, res, next) => {
  try {
    logger.debug('Received text completion request', {
      model: req.body.model,
      stream: req.body.stream === true,
      streamingEnabled: config.enableStreaming,
    });

    // Check if streaming is requested and enabled
    const streamRequested = req.body.stream === true;
    const streamingEnabled = config.enableStreaming;

    if (streamRequested && !streamingEnabled) {
      logger.info(
        'Streaming requested but disabled by configuration - falling back to non-streaming'
      );
      // Force non-streaming mode by setting stream to false
      req.body.stream = false;
      return completionHandler(req, res, next);
    } else if (streamRequested && streamingEnabled) {
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
