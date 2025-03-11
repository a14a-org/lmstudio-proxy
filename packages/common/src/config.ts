export interface Config {
  // Server configuration
  port: number;
  host: string;
  apiKey: string;

  // LM Studio configuration
  lmStudioHost: string;
  lmStudioPort: number;

  // Logging configuration
  logLevel: string;

  // Feature flags
  enableStreaming: boolean;
}

// Default configuration
export const defaultConfig: Config = {
  port: 8080,
  host: '0.0.0.0',
  apiKey: process.env.API_KEY || '',

  lmStudioHost: process.env.LM_STUDIO_HOST || 'localhost',
  lmStudioPort: parseInt(process.env.LM_STUDIO_PORT || '1234', 10),

  logLevel: process.env.LOG_LEVEL || 'info',

  // Feature flags - defaults to enabled
  enableStreaming: process.env.ENABLE_STREAMING !== 'false',
};
