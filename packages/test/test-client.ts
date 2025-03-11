import WebSocket from 'ws';
import {
  MessageType,
  createMessage,
  generateRequestId,
  BaseMessage,
  AuthMessage,
  AuthResultMessage,
  ModelsResponseMessage,
  ChatRequestMessage,
  ChatResponseMessage,
  StreamChunkMessage,
  StreamEndMessage,
} from '@lmstudio-proxy/common';

// Configuration
const CONFIG = {
  serverUrl: process.env.SERVER_URL || 'ws://localhost:3000/ws',
  apiKey: process.env.API_KEY || 'test-api-key',
  clientId: process.env.CLIENT_ID || `test-client-${Date.now()}`,
  verbose: process.env.VERBOSE === 'true',
};

// Track pending requests
const pendingRequests = new Map<
  string,
  {
    timestamp: number;
    type: MessageType;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }
>();

// Add data structure for tracking streaming responses
const streamingResponses = new Map<
  string,
  {
    chunks: string[];
    startTime: number;
  }
>();

// Status variables
let isConnected = false;
let isAuthenticated = false;
let ws: WebSocket | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

// Connect to the server
function connect(): void {
  console.log(`Connecting to ${CONFIG.serverUrl}...`);

  ws = new WebSocket(CONFIG.serverUrl);

  ws.on('open', handleOpen);
  ws.on('message', handleMessage);
  ws.on('close', handleClose);
  ws.on('error', handleError);
}

// Handle WebSocket open event
function handleOpen(): void {
  console.log('Connection established');
  isConnected = true;

  // Send authentication message
  sendAuthentication();

  // Set up ping interval
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      log('Sending ping');
      send(createMessage(MessageType.PING, {}));
    }
  }, 30000);
}

// Send authentication message
function sendAuthentication(): void {
  console.log('Sending authentication...');

  send(
    createMessage<AuthMessage>(MessageType.AUTH, {
      apiKey: CONFIG.apiKey,
      clientId: CONFIG.clientId,
    })
  );
}

// Handle WebSocket message event
function handleMessage(data: WebSocket.Data): void {
  try {
    const message = JSON.parse(data.toString()) as BaseMessage;

    if (!message || !message.type) {
      console.error('Received invalid message format');
      return;
    }

    log(`Received message of type: ${message.type}`);

    switch (message.type) {
      case MessageType.AUTH_RESULT:
        handleAuthResult(message as AuthResultMessage);
        break;
      case MessageType.PING:
        handlePing();
        break;
      case MessageType.PONG:
        log('Received pong');
        break;
      case MessageType.STREAM_CHUNK:
        handleStreamChunk(message as StreamChunkMessage);
        break;
      case MessageType.STREAM_END:
        handleStreamEnd(message as StreamEndMessage);
        break;
      default:
        handleResponse(message);
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

// Handle authentication result
function handleAuthResult(message: AuthResultMessage): void {
  if (message.success) {
    console.log('Successfully authenticated with server');
    isAuthenticated = true;

    // Start test sequence after authentication
    runTests();
  } else {
    console.error(`Authentication failed: ${message.error}`);
    isAuthenticated = false;
  }
}

// Handle ping message
function handlePing(): void {
  log('Received ping, sending pong');
  send(createMessage(MessageType.PONG, {}));
}

// Handle any response message
function handleResponse(message: BaseMessage): void {
  const requestId = message.requestId;

  if (!requestId) {
    log('Received message without requestId');
    return;
  }

  const pendingRequest = pendingRequests.get(requestId);
  if (!pendingRequest) {
    log(`No pending request found for id: ${requestId}`);
    return;
  }

  log(`Resolving request: ${requestId} (type: ${pendingRequest.type})`);
  pendingRequests.delete(requestId);

  if (message.type === MessageType.ERROR || message.type === MessageType.ERROR_RESPONSE) {
    pendingRequest.reject(new Error(`Server error: ${JSON.stringify(message)}`));
  } else {
    pendingRequest.resolve(message);
  }
}

// Handle WebSocket close event
function handleClose(code: number, reason: string): void {
  console.log(`Connection closed: ${code} - ${reason}`);
  isConnected = false;
  isAuthenticated = false;

  clearInterval(pingInterval!);
  pingInterval = null;

  // Attempt to reconnect
  reconnectTimeout = setTimeout(() => {
    console.log('Attempting to reconnect...');
    connect();
  }, 5000);
}

// Handle WebSocket error event
function handleError(error: Error): void {
  console.error('WebSocket error:', error);
}

// Send a message to the server
function send(message: any): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('Cannot send message: WebSocket is not open');
    return false;
  }

  try {
    const messageStr = JSON.stringify(message);
    log(`Sending message: ${messageStr}`);
    ws.send(messageStr);
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

// Run tests
async function runTests(): Promise<void> {
  try {
    console.log('\n=== Running tests ===\n');

    // Test 1: Get models
    console.log('TEST 1: Fetching models');
    const modelsResponse = await sendRequest<ModelsResponseMessage>(MessageType.MODELS_REQUEST);
    console.log('Models response:', JSON.stringify(modelsResponse, null, 2));

    // Test 2: Simple chat completion
    console.log('\nTEST 2: Simple chat completion');
    const chatResponse = await sendRequest<ChatResponseMessage>(MessageType.CHAT_REQUEST, {
      data: {
        model: 'test-model',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, how are you?' },
        ],
      },
    });
    console.log('Chat response:', JSON.stringify(chatResponse, null, 2));

    // Test 3: Ping-Pong
    console.log('\nTEST 3: Ping-Pong');
    send(createMessage(MessageType.PING, {}));

    // Test 4: Test streaming (this will send direct stream messages for debugging)
    console.log('\nTEST 4: Test streaming');

    // Create a test stream chunk
    const streamRequestId = `test_stream_${Date.now()}`;
    console.log(`Sending test stream chunk (requestId: ${streamRequestId})`);

    // Register a pending request to receive the stream
    const streamPromise = new Promise((resolve, reject) => {
      pendingRequests.set(streamRequestId, {
        timestamp: Date.now(),
        type: MessageType.CHAT_REQUEST, // Pretend this is a chat request
        resolve,
        reject,
      });
    });

    // Send a test stream chunk
    const chunkMessage = createMessage<StreamChunkMessage>(MessageType.STREAM_CHUNK, {
      requestId: streamRequestId,
      data: JSON.stringify({
        id: `chatcmpl-${streamRequestId}`,
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              content: 'This is a test streaming response!',
            },
            finish_reason: null,
          },
        ],
      }),
    });

    // Explicitly set type as string for serialization
    (chunkMessage as any).type = String(MessageType.STREAM_CHUNK);
    send(chunkMessage);

    // Send a stream end message after a delay
    setTimeout(() => {
      console.log(`Sending test stream end (requestId: ${streamRequestId})`);
      const endMessage = createMessage<StreamEndMessage>(MessageType.STREAM_END, {
        requestId: streamRequestId,
      });
      // Explicitly set type as string for serialization
      (endMessage as any).type = String(MessageType.STREAM_END);
      send(endMessage);
    }, 1000);

    // Wait for the stream to complete
    const streamResult = await streamPromise;
    console.log('Stream test complete:', JSON.stringify(streamResult, null, 2));

    console.log('\n=== Tests completed ===\n');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Send a request with a specific type and wait for the response
function sendRequest<T extends BaseMessage>(
  type: MessageType,
  data: Record<string, any> = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();

    // Register the pending request
    pendingRequests.set(requestId, {
      timestamp: Date.now(),
      type,
      resolve,
      reject,
    });

    // Create and send the message
    const message = createMessage(type, {
      requestId,
      ...data,
    });

    if (!send(message)) {
      pendingRequests.delete(requestId);
      reject(new Error('Failed to send message'));
    }

    // Set a timeout for the request
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }
    }, 10000);
  });
}

// Utility function for verbose logging
function log(message: string): void {
  if (CONFIG.verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

// Handle application shutdown
function shutdown(): void {
  console.log('Shutting down...');

  if (pingInterval) {
    clearInterval(pingInterval);
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  if (ws) {
    ws.close();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

// Start the client
console.log('LM Studio Proxy Test Client');
console.log(`Server URL: ${CONFIG.serverUrl}`);
console.log(`Client ID: ${CONFIG.clientId}`);
connect();

// Add handlers for stream messages
function handleStreamChunk(message: StreamChunkMessage): void {
  const { requestId, data } = message;
  log(`Received stream chunk for request: ${requestId}`);

  // Initialize streaming response if first chunk
  if (!streamingResponses.has(requestId)) {
    streamingResponses.set(requestId, {
      chunks: [],
      startTime: Date.now(),
    });
    log(`Started collecting stream for request: ${requestId}`);
  }

  // Store the chunk
  const streamingResponse = streamingResponses.get(requestId)!;
  streamingResponse.chunks.push(data);

  // Try to parse and log the data
  try {
    const parsedData = JSON.parse(data);
    log(`Stream chunk data (parsed): ${JSON.stringify(parsedData, null, 2)}`);
  } catch (error) {
    log(`Stream chunk contains non-JSON data (length: ${data.length})`);
    log(`Data preview: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
  }

  // Log information about the pending request
  const pendingRequest = pendingRequests.get(requestId);
  if (pendingRequest) {
    log(`Received chunk for pending request: ${requestId} (type: ${pendingRequest.type})`);
  } else {
    log(`Warning: No pending request found for stream chunk: ${requestId}`);
  }
}

function handleStreamEnd(message: StreamEndMessage): void {
  const { requestId } = message;
  log(`Received stream end for request: ${requestId}`);

  const streamingResponse = streamingResponses.get(requestId);
  if (!streamingResponse) {
    log(`Warning: Received stream end for unknown stream: ${requestId}`);
    return;
  }

  // Log stream completion statistics
  const { chunks, startTime } = streamingResponse;
  const totalChunks = chunks.length;
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const duration = Date.now() - startTime;

  log(`Stream complete for request ${requestId}:`);
  log(`- Total chunks: ${totalChunks}`);
  log(`- Total data length: ${totalLength} characters`);
  log(`- Duration: ${duration}ms`);

  // Try to combine and parse the data
  try {
    const combinedData = chunks.join('');
    log(
      `Combined data (first 200 chars): ${combinedData.substring(0, 200)}${
        combinedData.length > 200 ? '...' : ''
      }`
    );

    // If the combined data is valid JSON, log it in a structured way
    try {
      const parsedData = JSON.parse(combinedData);
      log(`Parsed combined data: ${JSON.stringify(parsedData, null, 2)}`);
    } catch {
      log(`Combined data is not valid JSON`);
    }
  } catch (error) {
    log(`Error processing combined stream data: ${error}`);
  }

  // Clean up the streaming data
  streamingResponses.delete(requestId);

  // Now resolve the pending request
  const pendingRequest = pendingRequests.get(requestId);
  if (pendingRequest) {
    log(`Resolving request: ${requestId} (type: ${pendingRequest.type})`);
    pendingRequests.delete(requestId);

    // Create a "complete" response with the accumulated data
    const completeResponse = {
      ...message,
      data: chunks.join(''),
      streamingData: {
        chunks,
        chunkCount: chunks.length,
        totalLength,
        duration,
      },
    };

    pendingRequest.resolve(completeResponse);
  } else {
    log(`Warning: No pending request found for stream end: ${requestId}`);
  }
}
