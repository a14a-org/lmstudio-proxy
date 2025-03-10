import WebSocket from 'ws';
import { ClientManager } from './client-manager';
import { createLogger } from '../utils/logger';
import { MessageType } from '@lmstudio-proxy/common';
import { processChatResponse } from '../api/controllers/chat';
import { processCompletionResponse } from '../api/controllers/completions';
import { processEmbeddingsResponse } from '../api/controllers/embeddings';
import { processModelsResponse } from '../api/controllers/models';

const logger = createLogger('message-handler');

// Define extended WebSocket type
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  isAuthenticated: boolean;
  clientId: string;
}

/**
 * Handle messages from authenticated clients
 */
export function handleMessage(
  ws: ExtendedWebSocket,
  message: any,
  // Using _ prefix to indicate intentionally unused parameter
  _clientManager: ClientManager
): void {
  if (!message.type) {
    sendError(ws, 'Invalid message format: missing type');
    return;
  }

  logger.debug(`Received message type: ${message.type}`, { requestId: message.requestId });

  switch (message.type) {
    case MessageType.PING:
      handlePing(ws);
      break;

    case MessageType.CHAT_RESPONSE:
      processChatResponse(message);
      break;

    case MessageType.COMPLETION_RESPONSE:
      processCompletionResponse(message);
      break;

    case MessageType.EMBEDDINGS_RESPONSE:
      processEmbeddingsResponse(message);
      break;

    case MessageType.MODELS_RESPONSE:
      processModelsResponse(message);
      break;

    case MessageType.ERROR_RESPONSE:
      handleErrorResponse(message);
      break;

    default:
      sendError(ws, `Unknown message type: ${message.type}`);
  }
}

/**
 * Handle ping messages
 */
function handlePing(ws: ExtendedWebSocket): void {
  ws.send(
    JSON.stringify({
      type: MessageType.PONG,
      timestamp: Date.now(),
    })
  );
}

/**
 * Handle error response messages
 */
function handleErrorResponse(message: any): void {
  // Use response routing to forward to waiting HTTP client
  logger.error('Received error response', {
    requestId: message.requestId,
    error: message.error,
  });

  // The actual implementation will depend on the request tracking system
  // that routes responses back to the appropriate HTTP request
}

/**
 * Send error message to client
 */
function sendError(ws: ExtendedWebSocket, errorMessage: string): void {
  logger.error(errorMessage);
  ws.send(
    JSON.stringify({
      type: MessageType.ERROR,
      error: errorMessage,
    })
  );
}
