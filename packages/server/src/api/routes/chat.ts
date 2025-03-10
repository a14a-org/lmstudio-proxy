import express from 'express';
import { chatCompletionHandler, chatCompletionStreamHandler } from '../controllers/chat';
import { createLogger } from '../../utils/logger';

const logger = createLogger('chat-routes');
const router = express.Router();

// Chat completions endpoint (streaming and non-streaming)
router.post('/completions', async (req, res, next) => {
  try {
    logger.debug('Received chat completion request', {
      model: req.body.model,
      stream: req.body.stream === true,
    });

    // Check if streaming is requested
    const stream = req.body.stream === true;

    if (stream) {
      // Handle streaming response
      return chatCompletionStreamHandler(req, res, next);
    } else {
      // Handle non-streaming response
      return chatCompletionHandler(req, res, next);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
