import WebSocket from 'ws';
import { PassThrough } from 'stream';
import {
  MessageType,
  BaseMessage,
  AuthMessage,
  AuthResultMessage,
  RequestMessage,
  ErrorMessage,
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

      logger.debug(`Received message of type: ${message.type}`);

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
      }
    } catch (error) {
      logger.error('Error handling message:', error);
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

      if (message.stream) {
        await this.handleStreamingRequest(requestId, endpoint, data);
      } else {
        const response = await this.lmStudioClient.makeRequest(endpoint, data);

        // Send response back to server
        this.send(
          createMessage(MessageType.CHAT_RESPONSE, {
            requestId,
            data: response,
          })
        );
      }
    } catch (error) {
      logger.error(`Error handling request ${requestId}:`, error);

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

      // Remove leading slash if present for comparison
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

      if (normalizedEndpoint === 'chat/completions') {
        stream = await this.lmStudioClient.streamChatCompletion(payload);
      } else if (normalizedEndpoint === 'completions') {
        stream = await this.lmStudioClient.streamCompletion(payload);
      } else {
        throw new Error(`Streaming not supported for endpoint: ${endpoint}`);
      }

      // Store the stream for potential cleanup later
      this.activeStreams.set(requestId, stream);

      // Process the stream data
      stream.on('data', chunk => {
        const data = chunk.toString();

        // Send the chunk to the server
        this.send(
          createMessage(MessageType.STREAM_CHUNK, {
            requestId,
            data,
          })
        );
      });

      // Handle stream end
      stream.on('end', () => {
        // Send stream end message
        this.send(createMessage(MessageType.STREAM_END, { requestId }));

        // Remove from active streams
        this.activeStreams.delete(requestId);
      });

      // Handle stream errors
      stream.on('error', error => {
        logger.error(`Stream error for request ${requestId}`, error);

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
      logger.error(`Error setting up stream for request ${requestId}`, error);

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
}
