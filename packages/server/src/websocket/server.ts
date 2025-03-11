import http from 'http';
import WebSocket from 'ws';
import { config } from '../config';
import { handleClientAuthentication } from './authentication';
import { ClientManager } from './client-manager';
import { handleMessage } from './message-handler';
import { createLogger } from '../utils/logger';

const logger = createLogger('websocket');
export const clientManager = new ClientManager();

// Extend WebSocket with custom properties
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  isAuthenticated: boolean;
  clientId: string;
}

export function setupWebSocketServer(server: http.Server): WebSocket.Server {
  const wss = new WebSocket.Server({
    server,
    path: config.wsPath,
  });

  logger.info(`WebSocket server initialized on path: ${config.wsPath}`);

  wss.on('connection', (ws: WebSocket, req) => {
    const extWs = ws as ExtendedWebSocket;
    const ip = req.socket.remoteAddress || 'unknown';
    logger.info(`New WebSocket connection from ${ip}`);

    // Set initial properties
    extWs.isAlive = true;
    extWs.isAuthenticated = false;
    extWs.clientId = '';

    // Handle pong messages to track connection liveness
    extWs.on('pong', () => {
      extWs.isAlive = true;
    });

    // Handle authentication and messages
    extWs.on('message', (data: WebSocket.RawData) => {
      try {
        const rawMessage = data.toString();
        logger.debug('Raw WebSocket message received:', {
          rawMessageLength: rawMessage.length,
          rawMessagePreview:
            rawMessage.length > 500 ? rawMessage.substring(0, 500) + '...' : rawMessage,
          timestamp: new Date().toISOString(),
        });

        const message = JSON.parse(rawMessage);

        logger.debug('Parsed WebSocket message:', {
          messageKeys: Object.keys(message),
          messageType: message.type,
          messageTypeType: typeof message.type,
          requestId: message.requestId,
          timestamp: new Date().toISOString(),
        });

        if (!extWs.isAuthenticated) {
          // Handle authentication if not yet authenticated
          handleClientAuthentication(extWs, message, clientManager);
        } else {
          // Handle regular messages if already authenticated
          handleMessage(extWs, message, clientManager);
        }
      } catch (error) {
        logger.error('Error processing WebSocket message:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
        extWs.send(
          JSON.stringify({
            type: 'error',
            error: 'Invalid message format',
            details: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });

    // Handle connection close
    extWs.on('close', (code, reason) => {
      logger.info(`WebSocket connection closed: ${code} ${reason}`);
      if (extWs.clientId) {
        clientManager.removeClient(extWs.clientId);
      }
    });

    // Handle errors
    extWs.on('error', error => {
      logger.error('WebSocket error:', error);
    });
  });

  // Set up interval for ping-pong to detect broken connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      const extWs = ws as ExtendedWebSocket;
      if (extWs.isAlive === false) {
        logger.warn('Terminating inactive WebSocket connection');
        return extWs.terminate();
      }

      extWs.isAlive = false;
      extWs.ping();
    });
  }, config.wsPingIntervalMs);

  // Clean up interval on server close
  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  return wss;
}
