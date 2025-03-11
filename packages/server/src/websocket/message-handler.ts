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

  // Log detailed information about the message and MessageType
  const messageTypeStr = message.type;
  const messageTypeValues = Object.values(MessageType);
  const messageTypeKeys = Object.keys(MessageType);

  // Get all enum values as strings for comparison
  const enumValuesAsStrings = messageTypeValues.map(val => String(val));

  logger.debug(`Received message from client:`, {
    requestId: message.requestId,
    messageType: messageTypeStr,
    messageTypeType: typeof messageTypeStr,
    messageTypeInEnum: messageTypeValues.includes(messageTypeStr),
    messageTypeInEnumAsString: enumValuesAsStrings.includes(messageTypeStr),
    messageTypeKeys,
    messageTypeValues,
    enumValuesAsStrings,
    messageJSON:
      JSON.stringify(message).substring(0, 200) +
      (JSON.stringify(message).length > 200 ? '...' : ''),
    timestamp: new Date().toISOString(),
  });

  // Enhanced string comparison with normalization
  const messageTypeLower =
    typeof messageTypeStr === 'string' ? messageTypeStr.toLowerCase().trim() : '';
  const enumValuesAsStringsLower = enumValuesAsStrings.map(val => val.toLowerCase().trim());

  // Create a working variable that we can modify
  let normalizedMessageType = messageTypeStr;

  // Improved validation for message type
  if (
    !messageTypeValues.includes(messageTypeStr) &&
    !enumValuesAsStrings.includes(messageTypeStr) &&
    !enumValuesAsStringsLower.includes(messageTypeLower)
  ) {
    // Special case check for stream messages
    if (messageTypeLower === 'stream_chunk' || messageTypeLower.includes('stream_chunk')) {
      logger.debug(`Detected stream_chunk message with non-standard type format`);
      normalizedMessageType = 'stream_chunk';
    } else if (messageTypeLower === 'stream_end' || messageTypeLower.includes('stream_end')) {
      logger.debug(`Detected stream_end message with non-standard type format`);
      normalizedMessageType = 'stream_end';
    } else {
      // Only show error and return for truly unknown types
      logger.error(`Unknown message type: ${messageTypeStr}`, {
        availableTypes: messageTypeValues,
        availableTypesAsStrings: enumValuesAsStrings,
        receivedType: messageTypeStr,
        typeofReceivedType: typeof messageTypeStr,
        messageKeys: Object.keys(message),
        normalized: messageTypeLower,
        normalizedMatch: enumValuesAsStringsLower.includes(messageTypeLower),
      });
      sendError(ws, `Unknown message type: ${messageTypeStr}`);
      return;
    }
  }

  // For the switch statement, convert string type to enum value if needed
  let messageTypeForSwitch: MessageType;

  if (typeof normalizedMessageType === 'string') {
    // Handle case insensitive comparison with lowercase
    const normalizedTypeLower = normalizedMessageType.toLowerCase().trim();

    // Try to find matching enum by its string value
    const matchingEnum = Object.entries(MessageType).find(
      ([key, value]) => String(value).toLowerCase().trim() === normalizedTypeLower
    );

    if (matchingEnum) {
      messageTypeForSwitch = matchingEnum[1] as MessageType;
      logger.debug(
        `Matched string message type to enum: "${normalizedMessageType}" -> ${messageTypeForSwitch}`
      );
    } else {
      // Explicit mapping for known problematic message types
      if (normalizedTypeLower === 'stream_chunk') {
        messageTypeForSwitch = MessageType.STREAM_CHUNK;
        logger.debug(`Manually mapped 'stream_chunk' to MessageType.STREAM_CHUNK`);
      } else if (normalizedTypeLower === 'stream_end') {
        messageTypeForSwitch = MessageType.STREAM_END;
        logger.debug(`Manually mapped 'stream_end' to MessageType.STREAM_END`);
      } else {
        // Fallback - use the string directly and let the switch handle it
        messageTypeForSwitch = normalizedMessageType as unknown as MessageType;
        logger.debug(`Using string message type directly: "${normalizedMessageType}"`);
      }
    }
  } else {
    messageTypeForSwitch = normalizedMessageType as MessageType;
  }

  switch (messageTypeForSwitch) {
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

    case MessageType.STREAM_CHUNK:
      handleStreamChunk(message);
      break;

    case MessageType.STREAM_END:
      handleStreamEnd(message);
      break;

    default:
      sendError(ws, `Unknown message type: ${messageTypeStr}`);
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
 * Handle streaming chunk messages
 */
function handleStreamChunk(message: any): void {
  const { requestId, data } = message;

  if (!requestId) {
    logger.error('Received stream chunk without requestId');
    return;
  }

  logger.debug(`Received stream chunk for request ${requestId}`, {
    requestId,
    dataLength: typeof data === 'string' ? data.length : JSON.stringify(data).length,
    dataPreview:
      typeof data === 'string'
        ? data.substring(0, 50) + '...'
        : JSON.stringify(data).substring(0, 50) + '...',
    timestamp: new Date().toISOString(),
  });

  // Forward to the appropriate response processor based on the request type
  try {
    if (requestId.startsWith('chat_')) {
      logger.debug(`Processing chat stream chunk for request ${requestId}`);
      processChatResponse({ requestId, data, stream: true });
    } else if (requestId.startsWith('completion_')) {
      logger.debug(`Processing completion stream chunk for request ${requestId}`);
      processCompletionResponse({ requestId, data, stream: true });
    } else {
      logger.warn(`Unknown request type for stream chunk: ${requestId}`);
    }
  } catch (error) {
    logger.error(`Error processing stream chunk for request ${requestId}`, {
      error: error instanceof Error ? error.message : String(error),
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Handle stream end messages
 */
function handleStreamEnd(message: any): void {
  const { requestId } = message;

  if (!requestId) {
    logger.error('Received stream end without requestId');
    return;
  }

  logger.debug(`Received stream end for request ${requestId}`, {
    requestId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Notify the appropriate processor that the stream has ended
    if (requestId.startsWith('chat_')) {
      logger.debug(`Processing chat stream end for request ${requestId}`);
      processChatResponse({ requestId, streamEnd: true });
    } else if (requestId.startsWith('completion_')) {
      logger.debug(`Processing completion stream end for request ${requestId}`);
      processCompletionResponse({ requestId, streamEnd: true });
    } else {
      logger.warn(`Unknown request type for stream end: ${requestId}`);
    }
  } catch (error) {
    logger.error(`Error processing stream end for request ${requestId}`, {
      error: error instanceof Error ? error.message : String(error),
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
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
