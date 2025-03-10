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

    // Create axios instance for non-streaming requests
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info(`LM Studio client initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Make a non-streaming request to LM Studio
   */
  async makeRequest(endpoint: string, payload: any): Promise<any> {
    try {
      logger.debug(`Making request to ${endpoint}`, { payload });

      // Special handling for models endpoint - should be a GET request
      if (endpoint === API_ENDPOINTS.MODELS) {
        const response = await this.axiosInstance.get(endpoint);
        return response.data;
      }

      // For all other endpoints, use POST
      const response = await this.axiosInstance.post(endpoint, payload);
      return response.data;
    } catch (error) {
      logger.error(`Error making request to LM Studio (${endpoint})`, error);
      throw error;
    }
  }

  /**
   * Stream chat completions from LM Studio
   */
  async streamChatCompletion(payload: any): Promise<PassThrough> {
    return this.streamRequest(API_ENDPOINTS.CHAT_COMPLETIONS, payload);
  }

  /**
   * Stream completions from LM Studio
   */
  async streamCompletion(payload: any): Promise<PassThrough> {
    return this.streamRequest(API_ENDPOINTS.COMPLETIONS, payload);
  }

  /**
   * Make a streaming request to LM Studio
   */
  private async streamRequest(endpoint: string, payload: any): Promise<PassThrough> {
    const outputStream = new PassThrough();

    try {
      logger.debug(`Making streaming request to ${endpoint}`, { payload });

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
      });

      // Pipe the response stream to our output stream
      response.data.pipe(outputStream);

      // Handle errors
      response.data.on('error', (err: Error) => {
        logger.error(`Error in streaming response from LM Studio (${endpoint})`, err);
        outputStream.emit('error', err);
        outputStream.end();
      });
    } catch (error) {
      logger.error(`Error setting up streaming request to LM Studio (${endpoint})`, error);
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
