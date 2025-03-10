import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { clientManager } from '../../websocket/server';
import { MessageType } from '@lmstudio-proxy/common';
import { ApiError } from '../../utils/error';
import { createLogger } from '../../utils/logger';

const logger = createLogger('completions-controller');

// Request tracking map to route responses back to the correct HTTP client
const pendingRequests = new Map();

/**
 * Handle text completion requests (non-streaming)
 */
export async function completionHandler(
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
        timeout: setTimeout(() => {
          pendingRequests.delete(requestId);
          reject(new ApiError(504, 'Request timeout'));
        }, 60000), // 60 second timeout
      });
    });

    // Forward the request to the LM Studio client
    client.send(
      JSON.stringify({
        type: MessageType.COMPLETION_REQUEST,
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
 * Handle streaming text completion requests
 */
export async function completionStreamHandler(
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

    // Set up SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create a stream handler
    const handleStream = (chunk: any) => {
      // Format chunk as SSE data
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      // If this is the final chunk, end the response
      if (chunk.choices && chunk.choices[0].finish_reason) {
        res.write('data: [DONE]\n\n');
        res.end();
        return true;
      }
      return false;
    };

    // Store the request handlers
    pendingRequests.set(requestId, {
      handleStream,
      timeout: setTimeout(() => {
        pendingRequests.delete(requestId);
        res.write('data: [ERROR] Request timeout\n\n');
        res.end();
      }, 300000), // 5 minute timeout for streaming
    });

    // Forward the request to the LM Studio client
    client.send(
      JSON.stringify({
        type: MessageType.COMPLETION_REQUEST,
        requestId,
        stream: true,
        data: req.body,
      })
    );

    // Handle client disconnect
    req.on('close', () => {
      if (pendingRequests.has(requestId)) {
        const { timeout } = pendingRequests.get(requestId);
        clearTimeout(timeout);
        pendingRequests.delete(requestId);

        // Notify client to stop processing
        client.send(
          JSON.stringify({
            type: MessageType.CANCEL_REQUEST,
            requestId,
          })
        );
      }
    });
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
 * Process incoming text completion response
 * This is called from the message handler when a response is received
 */
export function processCompletionResponse(message: any): void {
  const { requestId, data, error, stream } = message;

  if (!pendingRequests.has(requestId)) {
    logger.warn(`Received response for unknown request: ${requestId}`);
    return;
  }

  const request = pendingRequests.get(requestId);

  if (error) {
    // Handle error response
    if (stream) {
      request.handleStream({ error: error.message || 'Unknown error' });
      clearTimeout(request.timeout);
      pendingRequests.delete(requestId);
    } else {
      request.reject(new ApiError(500, error.message || 'Unknown error'));
      clearTimeout(request.timeout);
      pendingRequests.delete(requestId);
    }
    return;
  }

  if (stream) {
    // Handle streaming response chunk
    const done = request.handleStream(data);
    if (done) {
      clearTimeout(request.timeout);
      pendingRequests.delete(requestId);
    }
  } else {
    // Handle complete response
    request.resolve(data);
    clearTimeout(request.timeout);
    pendingRequests.delete(requestId);
  }
}
