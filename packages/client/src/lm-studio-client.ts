import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { PassThrough } from 'stream';
import { LM_STUDIO_API_PATH, API_ENDPOINTS } from '@lmstudio-proxy/common';
import { config } from './config';
import { createLogger } from './utils/logger';

const logger = createLogger('lm-studio-client');

/**
 * Client for interacting with local LM Studio API
 */
export class LMStudioClient {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = `http://${config.lmStudioHost}:${config.lmStudioPort}${LM_STUDIO_API_PATH}`;
    logger.info('Initializing LM Studio client with configuration:', {
      host: config.lmStudioHost,
      port: config.lmStudioPort,
      apiPath: LM_STUDIO_API_PATH,
      baseUrl: this.baseUrl
    });

    // Create axios instance for non-streaming requests with increased timeout
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 300000, // 5 minutes timeout for regular requests
    });

    logger.info(`LM Studio client initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Make a non-streaming request to LM Studio
   */
  async makeRequest(endpoint: string, payload: any): Promise<any> {
    try {
      logger.info('Received incoming request:', {
        endpoint,
        method: endpoint === API_ENDPOINTS.MODELS ? 'GET' : 'POST',
        payload,
        timestamp: new Date().toISOString()
      });

      logger.debug(`Making request to ${endpoint}`, { 
        endpoint,
        baseUrl: this.baseUrl,
        fullUrl: `${this.baseUrl}${endpoint}`,
        payload 
      });

      // Special handling for models endpoint - should be a GET request
      if (endpoint === API_ENDPOINTS.MODELS) {
        logger.debug('Making GET request to models endpoint');
        const response = await this.axiosInstance.get(endpoint, {
          timeout: 300000 // 5 minutes timeout for models request
        });
        logger.info('Received response from LM Studio models endpoint:', {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          timestamp: new Date().toISOString()
        });
        return response.data;
      }

      // For all other endpoints, use POST
      logger.debug('Making POST request to endpoint');
      const response = await this.axiosInstance.post(endpoint, payload, {
        timeout: 300000 // 5 minutes timeout for other requests
      });
      logger.info('Received response from LM Studio endpoint:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        timestamp: new Date().toISOString()
      });
      return response.data;
    } catch (error) {
      logger.error(`Error making request to LM Studio (${endpoint})`, {
        error,
        endpoint,
        baseUrl: this.baseUrl,
        fullUrl: `${this.baseUrl}${endpoint}`,
        payload,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Stream chat completions from LM Studio
   */
  async streamChatCompletion(payload: any): Promise<PassThrough> {
    const requestId = Math.random().toString(36).substring(7);
    logger.info('Received incoming streaming chat completion request:', {
      requestId,
      endpoint: API_ENDPOINTS.CHAT_COMPLETIONS,
      payload,
      timestamp: new Date().toISOString()
    });
    return this.streamRequest(API_ENDPOINTS.CHAT_COMPLETIONS, payload, requestId);
  }

  /**
   * Stream completions from LM Studio
   */
  async streamCompletion(payload: any): Promise<PassThrough> {
    const requestId = Math.random().toString(36).substring(7);
    logger.info('Received incoming streaming completion request:', {
      requestId,
      endpoint: API_ENDPOINTS.COMPLETIONS,
      payload,
      timestamp: new Date().toISOString()
    });
    return this.streamRequest(API_ENDPOINTS.COMPLETIONS, payload, requestId);
  }

  /**
   * Make a streaming request to LM Studio
   */
  private async streamRequest(endpoint: string, payload: any, requestId: string): Promise<PassThrough> {
    const outputStream = new PassThrough();

    try {
      logger.info(`Starting streaming request ${requestId}:`, {
        endpoint,
        baseUrl: this.baseUrl,
        fullUrl: `${this.baseUrl}${endpoint}`,
        timestamp: new Date().toISOString()
      });

      // Ensure stream is set to true
      payload.stream = true;

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}${endpoint}`,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        responseType: 'stream',
        timeout: 600000, // 10 minutes timeout for streaming requests
      });

      logger.info(`Stream ${requestId} connected:`, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        timestamp: new Date().toISOString()
      });

      // Pipe the response stream to our output stream
      response.data.pipe(outputStream);

      // Handle data chunks
      response.data.on('data', (chunk: Buffer) => {
        logger.debug(`Stream ${requestId} received chunk:`, {
          chunk: chunk.toString(),
          timestamp: new Date().toISOString()
        });
      });

      // Handle errors
      response.data.on('error', (err: Error) => {
        logger.error(`Error in streaming response from LM Studio (${endpoint})`, {
          error: err,
          requestId,
          endpoint,
          timestamp: new Date().toISOString()
        });
        outputStream.emit('error', err);
        outputStream.end();
      });

      // Handle stream end
      response.data.on('end', () => {
        logger.info(`Stream ${requestId} completed`, {
          endpoint,
          timestamp: new Date().toISOString()
        });
      });
    } catch (error) {
      logger.error(`Error setting up streaming request to LM Studio (${endpoint})`, {
        error,
        requestId,
        endpoint,
        timestamp: new Date().toISOString()
      });
      outputStream.emit('error', error);
      outputStream.end();
    }

    return outputStream;
  }

  /**
   * Check if LM Studio is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Try to get models list as a simple availability check
      await this.axiosInstance.get(API_ENDPOINTS.MODELS);
      return true;
    } catch (error) {
      logger.error('LM Studio availability check failed', error);
      return false;
    }
  }
}
