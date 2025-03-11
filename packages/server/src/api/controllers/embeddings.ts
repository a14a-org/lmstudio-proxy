import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { clientManager } from '../../websocket/server';
import { MessageType } from '@lmstudio-proxy/common';
import { ApiError } from '../../utils/error';
import { createLogger } from '../../utils/logger';

const logger = createLogger('embeddings-controller');

// Track pending requests
const pendingRequests = new Map<string, any>();
// Export pendingRequests for use in other modules
export { pendingRequests };

/**
 * Handle embeddings requests
 */
export async function embeddingsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requestId = uuidv4();

  try {
    // Find an available client to handle the request
    const client = clientManager.findAvailableClient(req.body.model);

    if (!client) {
      throw new ApiError(503, 'No available LM Studio clients');
    }

    // Create a promise that will be resolved when the response is received
    const responsePromise = new Promise((resolve, reject) => {
      // Store the request handlers
      pendingRequests.set(requestId, {
        resolve,
        reject,
        type: 'embeddings',
        handler: processEmbeddingsResponse,
        timeout: setTimeout(() => {
          pendingRequests.delete(requestId);
          reject(new ApiError(504, 'Request timeout'));
        }, 30000), // 30 second timeout
      });
    });

    // Forward the request to the LM Studio client
    client.send(
      JSON.stringify({
        type: MessageType.EMBEDDINGS_REQUEST,
        requestId,
        data: req.body,
      })
    );

    // Wait for the response
    const response = await responsePromise;

    // Send the response back to the client
    res.json(response);
  } catch (error) {
    // Clean up if there was an error
    if (pendingRequests.has(requestId)) {
      const { timeout } = pendingRequests.get(requestId);
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
    }
    next(error);
  }
}

/**
 * Process incoming embeddings response
 * This is called from the message handler when a response is received
 */
export function processEmbeddingsResponse(message: any): void {
  const { requestId, data, error } = message;

  if (!pendingRequests.has(requestId)) {
    logger.warn(`Received response for unknown request: ${requestId}`);
    return;
  }

  const request = pendingRequests.get(requestId);

  if (error) {
    // Handle error response
    request.reject(new ApiError(500, error.message || 'Unknown error'));
    clearTimeout(request.timeout);
    pendingRequests.delete(requestId);
    return;
  }

  // Handle successful response
  request.resolve(data);
  clearTimeout(request.timeout);
  pendingRequests.delete(requestId);
}
