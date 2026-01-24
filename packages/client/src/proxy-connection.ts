import WebSocket from 'ws';
import { PassThrough } from 'stream';
import {
  MessageType,
  BaseMessage,
  AuthMessage,
  AuthResultMessage,
  RequestMessage,
  ErrorMessage,
  StreamChunkMessage,
  createMessage,
  safeJsonParse,
  WS_PING_INTERVAL,
  API_ENDPOINTS,
} from '@lmstudio-proxy/common';
import { EventEmitter } from 'events';
import { LMStudioClient } from './lm-studio-client';
import { config } from './config';
import { createLogger } from './utils/logger';

const logger = createLogger('proxy-connection');

/**
 * Events emitted by the ProxyConnection
 */
export enum ConnectionEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  AUTHENTICATED = 'authenticated',
  AUTH_FAILED = 'auth_failed',
  ERROR = 'error',
}

/**
 * Manages the WebSocket connection to the remote server
 */
export class ProxyConnection extends EventEmitter {
  private ws: WebSocket | null = null;
  private authenticated = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private lmStudioClient: LMStudioClient;
  private activeStreams: Map<string, PassThrough> = new Map();

  constructor() {
    super();
    this.lmStudioClient = new LMStudioClient();
  }

  /**
   * Connect to the remote server
   */
  public connect(): void {
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }

    logger.info(`Connecting to remote server: ${config.remoteServerUrl}`);

    try {
      this.ws = new WebSocket(config.remoteServerUrl);

      this.ws.on('open', this.handleOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('close', this.handleClose.bind(this));
      this.ws.on('error', this.handleError.bind(this));
    } catch (error) {
      logger.error('Failed to create WebSocket connection', error);
      this.handleReconnection();
    }
  }

  /**
   * Disconnect from the remote server
   */
  public disconnect(): void {
    if (this.ws) {
      this.clearPingInterval();
      this.ws.close();
      this.ws = null;
      this.authenticated = false;
    }
  }

  /**
   * Send a message to the remote server
   */
  private send(message: BaseMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.error('Cannot send message: WebSocket is not open');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to send message', error);
      return false;
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    logger.info('Connected to remote server');
    this.emit(ConnectionEvent.CONNECTED);

    // Start ping interval
    this.setupPingInterval();

    // Send registration message
    this.sendRegistration();
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = safeJsonParse<BaseMessage>(data.toString(), {} as BaseMessage);

      if (!message || !message.type) {
        logger.error('Received invalid message format');
        return;
      }

      logger.debug(`Received message of type: ${message.type}`, {
        messageType: message.type,
        requestId: message.requestId,
        timestamp: new Date().toISOString(),
        message: JSON.stringify(message),
        availableMessageTypes: Object.values(MessageType),
      });

      if (message.type === MessageType.AUTH_RESULT) {
        this.handleAuthMessage(message as AuthResultMessage);
      } else if (
        message.type === MessageType.CHAT_REQUEST ||
        message.type === MessageType.COMPLETION_REQUEST ||
        message.type === MessageType.EMBEDDINGS_REQUEST ||
        message.type === MessageType.MODELS_REQUEST
      ) {
        this.handleRequestMessage(message as RequestMessage);
      } else if (message.type === MessageType.ERROR) {
        this.handleErrorMessage(message as ErrorMessage);
      } else if (message.type === MessageType.STREAM_CHUNK) {
        logger.debug(`Processing stream chunk for request ${message.requestId}`, {
          requestId: message.requestId,
          data: (message as StreamChunkMessage).data,
          timestamp: new Date().toISOString(),
        });
        const stream = this.activeStreams.get(message.requestId!);
        if (stream) {
          stream.write((message as StreamChunkMessage).data);
        } else {
          logger.warn(`No active stream found for request ${message.requestId}`);
        }
      } else if (message.type === MessageType.STREAM_END) {
        logger.debug(`Processing stream end for request ${message.requestId}`, {
          requestId: message.requestId,
          timestamp: new Date().toISOString(),
        });
        const stream = this.activeStreams.get(message.requestId!);
        if (stream) {
          stream.end();
          this.activeStreams.delete(message.requestId!);
        } else {
          logger.warn(`No active stream found for request ${message.requestId}`);
        }
      }
    } catch (error) {
      logger.error('Error handling message:', {
        error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: string): void {
    logger.info(`Disconnected from server: ${code} ${reason}`);
    this.clearPingInterval();
    this.authenticated = false;
    this.emit(ConnectionEvent.DISCONNECTED, { code, reason });

    // Attempt to reconnect
    this.handleReconnection();
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(error: Error): void {
    logger.error('WebSocket error', error);
    this.emit(ConnectionEvent.ERROR, error);
  }

  /**
   * Setup ping interval to keep connection alive
   */
  private setupPingInterval(): void {
    this.clearPingInterval();

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send ping message
        this.send(createMessage(MessageType.PING));
      }
    }, WS_PING_INTERVAL);
  }

  /**
   * Clear ping interval
   */
  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Handle reconnection to the server
   */
  private handleReconnection(): void {
    logger.info(`Attempting to reconnect in ${config.reconnectInterval}ms...`);

    setTimeout(() => {
      this.connect();
    }, config.reconnectInterval);
  }

  /**
   * Send registration message to the server
   */
  private sendRegistration(): void {
    const message = createMessage<AuthMessage>(MessageType.AUTH, {
      clientId: config.clientId,
      apiKey: config.apiKey,
    });

    logger.info('Sending registration message');
    this.send(message);
  }

  /**
   * Handle authentication message from server
   */
  private handleAuthMessage(message: AuthResultMessage): void {
    if (message.success) {
      this.authenticated = true;
      logger.info('Successfully authenticated with proxy server');
      this.emit(ConnectionEvent.AUTHENTICATED);
    } else {
      logger.error(`Authentication failed: ${message.error}`);
      this.authenticated = false;
      this.emit(ConnectionEvent.AUTH_FAILED, message.error);
    }
  }

  /**
   * Handle request message from server
   */
  private async handleRequestMessage(message: RequestMessage): Promise<void> {
    const { requestId, data } = message;

    try {
      // Determine the endpoint based on message type
      let endpoint = '';
      switch (message.type) {
        case MessageType.CHAT_REQUEST:
          endpoint = API_ENDPOINTS.CHAT_COMPLETIONS;
          break;
        case MessageType.COMPLETION_REQUEST:
          endpoint = API_ENDPOINTS.COMPLETIONS;
          break;
        case MessageType.EMBEDDINGS_REQUEST:
          endpoint = API_ENDPOINTS.EMBEDDINGS;
          break;
        case MessageType.MODELS_REQUEST:
          endpoint = API_ENDPOINTS.MODELS;
          break;
        default:
          throw new Error(`Unsupported request type: ${message.type}`);
      }

      logger.info(`Processing request ${requestId} for endpoint ${endpoint}`, {
        messageType: message.type,
        requestId,
        endpoint,
        timestamp: new Date().toISOString(),
      });

      if (message.stream) {
        await this.handleStreamingRequest(requestId, endpoint, data);
      } else {
        const response = await this.lmStudioClient.makeRequest(endpoint, data);

        // Determine the correct response message type based on the request type
        let responseType: MessageType;
        switch (message.type) {
          case MessageType.CHAT_REQUEST:
            responseType = MessageType.CHAT_RESPONSE;
            break;
          case MessageType.COMPLETION_REQUEST:
            responseType = MessageType.COMPLETION_RESPONSE;
            break;
          case MessageType.EMBEDDINGS_REQUEST:
            responseType = MessageType.EMBEDDINGS_RESPONSE;
            break;
          case MessageType.MODELS_REQUEST:
            responseType = MessageType.MODELS_RESPONSE;
            break;
          default:
            throw new Error(`Unsupported request type: ${message.type}`);
        }

        logger.info(`Sending response for request ${requestId}:`, {
          responseType,
          requestId,
          endpoint,
          timestamp: new Date().toISOString(),
        });

        // Send response back to server
        this.send(
          createMessage(responseType, {
            requestId,
            data: response,
          })
        );
      }
    } catch (error) {
      logger.error(`Error handling request ${requestId}:`, {
        error,
        requestId,
        endpoint: message.type,
        timestamp: new Date().toISOString(),
      });

      // Send error response
      this.send(
        createMessage(MessageType.ERROR_RESPONSE, {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Handle streaming request
   */
  private async handleStreamingRequest(
    requestId: string,
    endpoint: string,
    payload: any
  ): Promise<void> {
    try {
      let stream: PassThrough;
      let streamingFailed = false;

      // Remove leading slash if present for comparison
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

      logger.debug(`Setting up streaming request`, {
        requestId,
        endpoint: normalizedEndpoint,
        timestamp: new Date().toISOString(),
      });

      if (normalizedEndpoint === 'chat/completions') {
        stream = await this.lmStudioClient.streamChatCompletion(payload);
      } else if (normalizedEndpoint === 'completions') {
        stream = await this.lmStudioClient.streamCompletion(payload);
      } else {
        throw new Error(`Streaming not supported for endpoint: ${endpoint}`);
      }

      // Store the stream for potential cleanup later
      this.activeStreams.set(requestId, stream);
      logger.debug(`Stream stored for request ${requestId}`, {
        requestId,
        timestamp: new Date().toISOString(),
      });

      // Process the stream data
      stream.on('data', chunk => {
        try {
          const data = chunk.toString();
          logger.debug(`Stream data received for request ${requestId}`, {
            requestId,
            dataLength: data.length,
            dataPreview: data.substring(0, 50) + (data.length > 50 ? '...' : ''),
            timestamp: new Date().toISOString(),
          });

          // Send the chunk to the server
          const messageData = {
            requestId,
            data,
          };

          // Create message with proper string type
          const message = createMessage(MessageType.STREAM_CHUNK, messageData);

          // Explicit type conversion to ensure proper serialization
          const messageType = String(MessageType.STREAM_CHUNK);
          (message as any).type = messageType;

          logger.debug(`Sending stream chunk message to server for request ${requestId}`, {
            requestId,
            messageType: message.type,
            messageTypeRaw: MessageType.STREAM_CHUNK,
            messageTypeAsString: messageType,
            messageTypeType: typeof message.type,
            timestamp: new Date().toISOString(),
            messageKeys: Object.keys(message),
            messageAsJSON: JSON.stringify(message).substring(0, 100) + '...',
          });

          this.send(message);
        } catch (error) {
          if (!streamingFailed) {
            streamingFailed = true;
            logger.error(
              `Error processing stream chunk for request ${requestId}, falling back to non-streaming mode`,
              {
                error: error instanceof Error ? error.message : String(error),
                requestId,
                timestamp: new Date().toISOString(),
              }
            );

            // Cancel the stream
            stream.destroy();
            this.activeStreams.delete(requestId);

            // Fall back to non-streaming mode
            this.handleNonStreamingRequest(requestId, endpoint, payload).catch(fallbackError => {
              logger.error(`Fallback request also failed for request ${requestId}`, {
                error:
                  fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
                requestId,
                timestamp: new Date().toISOString(),
              });
            });
          }
        }
      });

      // Handle stream end
      stream.on('end', () => {
        if (!streamingFailed) {
          logger.debug(`Stream ended for request ${requestId}`, {
            requestId,
            timestamp: new Date().toISOString(),
          });

          // Create stream end message with proper type
          const endMessageData = { requestId };
          const endMessage = createMessage(MessageType.STREAM_END, endMessageData);

          // Explicit type conversion to ensure proper serialization
          const endMessageType = String(MessageType.STREAM_END);
          (endMessage as any).type = endMessageType;

          logger.debug(`Sending stream end message to server for request ${requestId}`, {
            requestId,
            messageType: endMessage.type,
            messageTypeRaw: MessageType.STREAM_END,
            messageTypeAsString: endMessageType,
            messageTypeType: typeof endMessage.type,
            timestamp: new Date().toISOString(),
            messageKeys: Object.keys(endMessage),
            messageAsJSON: JSON.stringify(endMessage).substring(0, 100) + '...',
          });

          this.send(endMessage);

          // Remove from active streams
          this.activeStreams.delete(requestId);
        }
      });

      // Handle stream errors
      stream.on('error', error => {
        logger.error(`Stream error for request ${requestId}`, {
          error,
          requestId,
          timestamp: new Date().toISOString(),
        });

        // Send error message
        this.send(
          createMessage(MessageType.ERROR, {
            requestId,
            error: error.message,
          })
        );

        // Remove from active streams
        this.activeStreams.delete(requestId);
      });
    } catch (error) {
      logger.error(`Error setting up stream for request ${requestId}`, {
        error,
        requestId,
        timestamp: new Date().toISOString(),
      });

      // Send error message
      this.send(
        createMessage(MessageType.ERROR, {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Handle error message from server
   */
  private handleErrorMessage(message: ErrorMessage): void {
    logger.error(`Received error from server: ${message.error}`);
    this.emit(ConnectionEvent.ERROR, new Error(message.error));
  }

  /**
   * Check if connected to the server
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Check if authenticated with the server
   */
  public isAuthenticated(): boolean {
    return this.authenticated;
  }

  private async handleNonStreamingRequest(
    requestId: string,
    endpoint: string,
    payload: any
  ): Promise<void> {
    try {
      logger.debug(`Falling back to non-streaming request for ${requestId}`, {
        requestId,
        endpoint,
        timestamp: new Date().toISOString(),
      });

      // Create a non-streaming payload by setting stream to false
      const nonStreamingPayload = { ...payload, stream: false };

      // Handle based on endpoint
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

      logger.debug(`Making non-streaming request to ${normalizedEndpoint}`, {
        requestId,
        endpoint: normalizedEndpoint,
        timestamp: new Date().toISOString(),
      });

      // Use makeRequest method which handles all non-streaming requests
      const response = await this.lmStudioClient.makeRequest(
        `/${normalizedEndpoint}`,
        nonStreamingPayload
      );

      // Send the response based on endpoint type
      if (normalizedEndpoint === 'chat/completions') {
        this.send(
          createMessage(MessageType.CHAT_RESPONSE, {
            requestId,
            response,
          })
        );
      } else if (normalizedEndpoint === 'completions') {
        this.send(
          createMessage(MessageType.COMPLETION_RESPONSE, {
            requestId,
            response,
          })
        );
      }
    } catch (error) {
      logger.error(`Error in non-streaming fallback for request ${requestId}`, {
        error: error instanceof Error ? error.message : String(error),
        requestId,
        timestamp: new Date().toISOString(),
      });

      // Send error message
      this.send(
        createMessage(MessageType.ERROR, {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Test stream chunk handling
   * This is a debugging method to test stream handling directly
   */
  public testStreamMessage(requestId = 'test_stream_'): void {
    if (!this.isConnected()) {
      logger.error('Cannot test stream messages: not connected');
      return;
    }

    logger.info('Sending test stream chunk message', {
      requestId,
      timestamp: new Date().toISOString(),
    });

    // Create test stream chunk message
    const testMessage = {
      type: MessageType.STREAM_CHUNK,
      requestId,
      data: JSON.stringify({
        id: `chatcmpl-${requestId}`,
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Test streaming content',
            },
            finish_reason: null,
          },
        ],
      }),
      timestamp: Date.now(),
    } as BaseMessage;

    // Explicitly set type as string for serialization
    (testMessage as any).type = String(MessageType.STREAM_CHUNK);

    logger.debug('Test stream message details:', {
      messageType: testMessage.type,
      messageTypeStr: String(testMessage.type),
      messageTypeValue: MessageType.STREAM_CHUNK,
      messageTypeValueString: String(MessageType.STREAM_CHUNK),
      messageTypeKeys: Object.keys(MessageType),
      messageTypeType: typeof testMessage.type,
      messageTypeEquals: testMessage.type === String(MessageType.STREAM_CHUNK),
      timestamp: new Date().toISOString(),
    });

    // Send the test message
    this.send(testMessage);

    // After a delay, send a stream end message
    setTimeout(() => {
      logger.info('Sending test stream end message', {
        requestId,
        timestamp: new Date().toISOString(),
      });

      const endMessage = {
        type: MessageType.STREAM_END,
        requestId,
        timestamp: Date.now(),
      } as BaseMessage;

      // Explicitly set type as string for serialization
      (endMessage as any).type = String(MessageType.STREAM_END);

      logger.debug('Test stream end message details:', {
        messageType: endMessage.type,
        messageTypeStr: String(endMessage.type),
        messageTypeValue: MessageType.STREAM_END,
        messageTypeValueString: String(MessageType.STREAM_END),
        messageTypeType: typeof endMessage.type,
        messageTypeEquals: endMessage.type === String(MessageType.STREAM_END),
        timestamp: new Date().toISOString(),
      });

      this.send(endMessage);
    }, 1000);
  }

  /**
   * Test stream end handling
   * This is a debugging method to test stream end directly
   */
  public testStreamEndMessage(requestId = 'test_stream_'): void {
    if (!this.isConnected()) {
      logger.error('Cannot test stream end messages: not connected');
      return;
    }

    logger.info('Sending test stream end message', {
      requestId,
      timestamp: new Date().toISOString(),
    });

    // Create test stream end message
    const endMessage = {
      type: MessageType.STREAM_END,
      requestId,
      timestamp: Date.now(),
    } as BaseMessage;

    // Explicitly set type as string for serialization
    const endMessageType = String(MessageType.STREAM_END);
    (endMessage as any).type = endMessageType;

    logger.debug('Test stream end message details:', {
      messageType: endMessage.type,
      messageTypeRaw: MessageType.STREAM_END,
      messageTypeAsString: endMessageType,
      messageTypeType: typeof endMessage.type,
      messageTypeKeys: Object.keys(MessageType),
      timestamp: new Date().toISOString(),
      messageAsJSON: JSON.stringify(endMessage),
    });

    // Send the test message
    this.send(endMessage);
  }

  /**
   * Test the full streaming sequence with a chunk followed by an end
   */
  public testStreamSequence(requestId = 'test_stream_sequence_'): void {
    if (!this.isConnected()) {
      logger.error('Cannot test stream sequence: not connected');
      return;
    }

    logger.info('Starting test stream sequence', {
      requestId,
      timestamp: new Date().toISOString(),
    });

    // First send a stream chunk
    this.testStreamMessage(requestId);

    // Then send stream end after a short delay
    setTimeout(() => {
      this.testStreamEndMessage(requestId);
    }, 500);
  }
}
