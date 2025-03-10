import express from 'express';
import http from 'http';
import cors from 'cors';
import { config, validateConfig } from './config';
import { setupWebSocketServer } from './websocket/server';
import { apiRouter } from './api';
import { errorHandler } from './middleware/error-handler';
import { createLogger } from './utils/logger';

const logger = createLogger('server');

async function main() {
  // Validate configuration
  const { valid, errors } = validateConfig();
  if (!valid) {
    logger.error('Invalid configuration:', errors);
    process.exit(1);
  }

  logger.info('Starting LM Studio Proxy Server...');
  logger.info(`Environment: ${config.nodeEnv}`);

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/v1', apiRouter);

  // Simple health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.send('LM Studio Proxy Server');
  });

  // Error handling middleware
  app.use(errorHandler);

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket server on the same HTTP server
  setupWebSocketServer(server);

  // Start the server
  server.listen(config.port, config.host, () => {
    logger.info(`Server listening on ${config.host}:${config.port}`);
    logger.info(`WebSocket server available at ${config.host}:${config.port}${config.wsPath}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => handleShutdown(server));
  process.on('SIGTERM', () => handleShutdown(server));
}

function handleShutdown(server: http.Server) {
  logger.info('Shutting down server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

// Start the server
main().catch(error => {
  logger.error('Server failed to start:', error);
  process.exit(1);
});
