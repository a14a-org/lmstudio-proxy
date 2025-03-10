import * as http from 'http';
import * as WebSocket from 'ws';
import {
  MessageType,
  createMessage,
  AuthMessage,
  RequestMessage,
  ModelsResponseMessage,
  ChatResponseMessage,
  CompletionResponseMessage,
  ErrorResponseMessage,
} from '@lmstudio-proxy/common';

// Configuration
const CONFIG = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKey: process.env.API_KEY || 'test-api-key',
  jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  wsPath: process.env.WS_PATH || '/ws',
  verbose: process.env.VERBOSE === 'true',
};

// Extend WebSocket with custom properties
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  isAuthenticated: boolean;
  clientId: string;
}

// Create HTTP server
const server = http.createServer();
const wss = new WebSocket.Server({
  server,
  path: CONFIG.wsPath,
});

// Connected clients
const clients = new Map<string, ExtendedWebSocket>();

// Handle new WebSocket connections
wss.on('connection', (ws: WebSocket) => {
  const extendedWs = ws as ExtendedWebSocket;
  extendedWs.isAlive = true;
  extendedWs.isAuthenticated = false;
  extendedWs.clientId = '';

  console.log('New client connected');

  // Handle messages
  extendedWs.on('message', (data: WebSocket.Data) => {
    handleMessage(extendedWs, data);
  });

  // Handle connection close
  extendedWs.on('close', () => {
    if (extendedWs.clientId) {
      clients.delete(extendedWs.clientId);
      console.log(`Client ${extendedWs.clientId} disconnected`);
    } else {
      console.log('Unauthenticated client disconnected');
    }
  });

  // Handle pong responses
  extendedWs.on('pong', () => {
    extendedWs.isAlive = true;
  });
});

// Handle incoming messages
function handleMessage(ws: ExtendedWebSocket, data: WebSocket.Data): void {
  try {
    const message = JSON.parse(data.toString());

    if (!message || !message.type) {
      sendError(ws, 'Invalid message format');
      return;
    }

    log(`Received message of type: ${message.type}`);

    // Process message based on type
    switch (message.type) {
      case MessageType.AUTH:
        handleAuth(ws, message as AuthMessage);
        break;
      case MessageType.PING:
        handlePing(ws);
        break;
      case MessageType.MODELS_REQUEST:
        handleModelsRequest(ws, message as RequestMessage);
        break;
      case MessageType.CHAT_REQUEST:
        handleChatRequest(ws, message as RequestMessage);
        break;
      case MessageType.COMPLETION_REQUEST:
        handleCompletionRequest(ws, message as RequestMessage);
        break;
      default:
        log(`Unhandled message type: ${message.type}`);
        sendError(ws, `Unsupported message type: ${message.type}`);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendError(ws, 'Error processing message');
  }
}

// Handle authentication
function handleAuth(ws: ExtendedWebSocket, message: AuthMessage): void {
  log(`Auth request from client: ${message.clientId}`);

  // Check API key
  if (message.apiKey !== CONFIG.apiKey) {
    console.log('Authentication failed: Invalid API key');
    send(
      ws,
      createMessage(MessageType.AUTH_RESULT, {
        success: false,
        error: 'Invalid API key',
      })
    );
    return;
  }

  // Authenticate client
  ws.isAuthenticated = true;
  ws.clientId = message.clientId;
  clients.set(message.clientId, ws);

  console.log(`Client ${message.clientId} authenticated`);

  // Send successful auth response
  send(
    ws,
    createMessage(MessageType.AUTH_RESULT, {
      success: true,
      token: 'mock-jwt-token-for-testing',
    })
  );
}

// Handle ping message
function handlePing(ws: ExtendedWebSocket): void {
  log('Ping received, sending pong');
  send(ws, createMessage(MessageType.PONG, {}));
}

// Handle models request
function handleModelsRequest(ws: ExtendedWebSocket, message: RequestMessage): void {
  if (!requireAuth(ws)) return;

  log(`Models request received: ${message.requestId}`);

  // Send mock models response
  send(
    ws,
    createMessage<ModelsResponseMessage>(MessageType.MODELS_RESPONSE, {
      requestId: message.requestId,
      data: {
        object: 'list',
        data: [
          { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'lmstudio', created: Date.now() },
          { id: 'gpt-4', object: 'model', owned_by: 'lmstudio', created: Date.now() },
          { id: 'llama3-8b-instruct', object: 'model', owned_by: 'lmstudio', created: Date.now() },
          {
            id: 'mixtral-8x7b-instruct',
            object: 'model',
            owned_by: 'lmstudio',
            created: Date.now(),
          },
        ],
      },
    })
  );
}

// Handle chat completion request
function handleChatRequest(ws: ExtendedWebSocket, message: RequestMessage): void {
  if (!requireAuth(ws)) return;

  log(`Chat request received: ${message.requestId}`);

  // Extract chat payload
  const data = message.data;

  if (!data || !data.messages || !Array.isArray(data.messages)) {
    sendErrorResponse(ws, message.requestId, 'Invalid chat request format');
    return;
  }

  // Create mock chat response
  const userMessage =
    data.messages.find((msg: any) => msg.role === 'user')?.content || 'No user message';

  send(
    ws,
    createMessage<ChatResponseMessage>(MessageType.CHAT_RESPONSE, {
      requestId: message.requestId,
      data: {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: data.model || 'test-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `This is a test response to: "${userMessage}"`,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70,
        },
      },
    })
  );
}

// Handle text completion request
function handleCompletionRequest(ws: ExtendedWebSocket, message: RequestMessage): void {
  if (!requireAuth(ws)) return;

  log(`Completion request received: ${message.requestId}`);

  // Extract completion payload
  const data = message.data;

  if (!data || !data.prompt) {
    sendErrorResponse(ws, message.requestId, 'Invalid completion request format');
    return;
  }

  // Create mock completion response
  const prompt = typeof data.prompt === 'string' ? data.prompt : data.prompt[0] || 'No prompt';

  send(
    ws,
    createMessage<CompletionResponseMessage>(MessageType.COMPLETION_RESPONSE, {
      requestId: message.requestId,
      data: {
        id: `cmpl-${Date.now()}`,
        object: 'text_completion',
        created: Math.floor(Date.now() / 1000),
        model: data.model || 'test-model',
        choices: [
          {
            text: `This is a test completion for: "${prompt}"`,
            index: 0,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      },
    })
  );
}

// Check authentication and send error if not authenticated
function requireAuth(ws: ExtendedWebSocket): boolean {
  if (!ws.isAuthenticated) {
    sendError(ws, 'Not authenticated');
    return false;
  }
  return true;
}

// Send error message
function sendError(ws: ExtendedWebSocket, errorMessage: string): void {
  console.log(`Sending error: ${errorMessage}`);
  send(
    ws,
    createMessage(MessageType.ERROR, {
      error: errorMessage,
    })
  );
}

// Send error response message
function sendErrorResponse(ws: ExtendedWebSocket, requestId: string, errorMessage: string): void {
  console.log(`Sending error response: ${errorMessage}`);
  send(
    ws,
    createMessage<ErrorResponseMessage>(MessageType.ERROR_RESPONSE, {
      requestId,
      error: errorMessage,
    })
  );
}

// Send message to client
function send(ws: WebSocket, message: any): void {
  if (ws.readyState !== WebSocket.OPEN) {
    console.log('Cannot send message: WebSocket is not open');
    return;
  }

  try {
    const messageStr = JSON.stringify(message);
    log(`Sending message: ${messageStr}`);
    ws.send(messageStr);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Utility function for verbose logging
function log(message: string): void {
  if (CONFIG.verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

// Set up ping interval to check for stale connections
const pingInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    const extendedWs = ws as ExtendedWebSocket;

    if (!extendedWs.isAlive) {
      console.log('Terminating inactive connection');
      return ws.terminate();
    }

    extendedWs.isAlive = false;
    ws.ping();
  });
}, 30000);

// Clean up on server close
wss.on('close', () => {
  clearInterval(pingInterval);
});

// Start the server
server.listen(CONFIG.port, () => {
  console.log(`Test server running on port ${CONFIG.port}`);
  console.log(`WebSocket endpoint: ws://localhost:${CONFIG.port}${CONFIG.wsPath}`);
  console.log(`API Key: ${CONFIG.apiKey}`);
});
