import http from 'http';
import express from 'express';
import request from 'supertest';
import WebSocket from 'ws';
import { setupWebSocketServer } from '../websocket/server';
import { apiRouter } from '../api';
import { MessageType } from '@lmstudio-proxy/common';
import { errorHandler } from '../middleware/error-handler';

describe('API Endpoints', () => {
  let server: http.Server;
  let app: express.Express;
  let wss: WebSocket.Server;
  let clientSocket: WebSocket;
  const port = 9001;
  const wsServerUrl = `ws://localhost:${port}/ws`;
  const testApiKey = 'test-api-key';
  const testClientId = 'test-client-123';
  let authToken: string;

  // Mock environment variables
  process.env.API_KEY = testApiKey;
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.WS_PATH = '/ws';

  beforeAll(done => {
    // Create Express app
    app = express();

    // Apply middleware
    app.use(express.json());

    // Routes
    app.use('/v1', apiRouter);

    // Error handler
    app.use(errorHandler);

    // Create HTTP server
    server = http.createServer(app);

    // Setup WebSocket server
    wss = setupWebSocketServer(server);

    // Start server
    server.listen(port, () => {
      console.log(`Test server running on port ${port}`);

      // Connect and authenticate test client
      connectTestClient(() => {
        done();
      });
    });
  });

  afterAll(done => {
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close();
    }

    wss.close(() => {
      server.close(done);
    });
  });

  // Helper function to connect test client
  function connectTestClient(callback: () => void) {
    clientSocket = new WebSocket(wsServerUrl);

    // Handle connection open
    clientSocket.on('open', () => {
      // Send authentication message
      clientSocket.send(
        JSON.stringify({
          type: MessageType.AUTH,
          apiKey: testApiKey,
          clientId: testClientId,
          timestamp: Date.now(),
        })
      );
    });

    // Handle messages from server
    clientSocket.on('message', (data: WebSocket.MessageEvent) => {
      const message = JSON.parse(data.data.toString());

      if (message.type === MessageType.AUTH_RESULT && message.success) {
        authToken = message.token;
        callback();
      }
    });

    // Handle errors
    clientSocket.on('error', error => {
      console.error('WebSocket client error:', error);
    });
  }

  // Models endpoint test
  it('should retrieve models list', async () => {
    // Setup client message handler for models request
    const messagePromise = new Promise<void>(resolve => {
      const messageHandler = (data: WebSocket.MessageEvent) => {
        const message = JSON.parse(data.data.toString());

        if (message.type === MessageType.MODELS_REQUEST) {
          clientSocket.send(
            JSON.stringify({
              type: MessageType.MODELS_RESPONSE,
              requestId: message.requestId,
              data: {
                object: 'list',
                data: [
                  { id: 'model-1', object: 'model', owned_by: 'test' },
                  { id: 'model-2', object: 'model', owned_by: 'test' },
                ],
              },
            })
          );

          // Remove this handler
          clientSocket.removeEventListener('message', messageHandler);
          resolve();
        }
      };

      clientSocket.addEventListener('message', messageHandler);
    });

    // Make API request to models endpoint
    const response = await request(app)
      .get('/v1/models')
      .set('Authorization', `Bearer ${authToken}`);

    // Ensure client handled the request
    await messagePromise;

    // Check response
    expect(response.status).toBe(200);
    expect(response.body.object).toBe('list');
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].id).toBe('model-1');
  });

  // Chat completions endpoint test
  it('should handle chat completions', async () => {
    // Setup client message handler
    const messagePromise = new Promise<void>(resolve => {
      const messageHandler = (data: WebSocket.MessageEvent) => {
        const message = JSON.parse(data.data.toString());

        if (message.type === MessageType.CHAT_REQUEST) {
          // Simulate response from LLM
          clientSocket.send(
            JSON.stringify({
              type: MessageType.CHAT_RESPONSE,
              requestId: message.requestId,
              data: {
                id: 'test-chat-123',
                object: 'chat.completion',
                created: Date.now(),
                model: 'test-model',
                choices: [
                  {
                    index: 0,
                    message: {
                      role: 'assistant',
                      content: 'This is a test response',
                    },
                    finish_reason: 'stop',
                  },
                ],
              },
            })
          );

          // Remove this handler
          clientSocket.removeEventListener('message', messageHandler);
          resolve();
        }
      };

      clientSocket.addEventListener('message', messageHandler);
    });

    // Make API request
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello, world!' }],
      });

    // Ensure client handled the request
    await messagePromise;

    // Check response
    expect(response.status).toBe(200);
    expect(response.body.choices[0].message.content).toBe('This is a test response');
  });
});
