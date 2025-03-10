import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { clientManager } from '../../websocket/server';
import { MessageType } from '@lmstudio-proxy/common';
import { ApiError } from '../../utils/error';
import { createLogger } from '../../utils/logger';

const logger = createLogger('models-controller');

// Request tracking map to route responses back to the correct HTTP client
const pendingRequests = new Map();

// Cache models list for a short time to avoid frequent requests
let modelsCache: any = null;
let modelsCacheExpiry = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Handle list models requests
 */
export async function listModelsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check cache first
    const now = Date.now();
    if (modelsCache && modelsCacheExpiry > now) {
      logger.debug('Returning cached models list');
      res.json(modelsCache);
      return;
    }

    const client = clientManager.findAvailableClient();

    if (!client) {
      // If no clients are available, return a default response
      res.json({
        object: 'list',
        data: [],
        message: 'No LM Studio clients connected',
      });
      return;
    }

    const requestId = uuidv4();

    // Create a promise that will be resolved when the response is received
    const responsePromise = new Promise((resolve, reject) => {
      // Store the request handlers
      pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: setTimeout(() => {
          pendingRequests.delete(requestId);
          reject(new ApiError(504, 'Request timeout'));
        }, 10000), // 10 second timeout
      });
    });

    // Forward the request to the LM Studio client
    client.send(
      JSON.stringify({
        type: MessageType.MODELS_REQUEST,
        requestId,
      })
    );

    // Wait for the response
    const response = await responsePromise;

    // Cache the response
    modelsCache = response;
    modelsCacheExpiry = now + CACHE_TTL_MS;

    // Send the response back to the client
    res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Process incoming models response
 * This is called from the message handler when a response is received
 */
export function processModelsResponse(message: any): void {
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
