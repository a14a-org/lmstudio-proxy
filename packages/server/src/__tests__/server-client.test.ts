// Set environment variables BEFORE importing modules that use config
const testApiKey = "test-api-key";
process.env.API_KEY = testApiKey;
process.env.JWT_SECRET = "test-jwt-secret";
process.env.WS_PATH = "/ws";

import http from "node:http";
import { MessageType } from "@lmstudio-proxy/common";
import express from "express";
import WebSocket from "ws";
import { setupWebSocketServer } from "../websocket/server";

describe("Server-Client Communication", () => {
	let server: http.Server;
	let wss: WebSocket.Server;
	let clientSocket: WebSocket;
	const port = 9000;
	const serverUrl = `ws://localhost:${port}/ws`;
	const testClientId = "test-client-123";

	beforeAll((done) => {
		// Create HTTP server
		const app = express();
		server = http.createServer(app);

		// Setup WebSocket server
		wss = setupWebSocketServer(server);

		// Start server
		server.listen(port, () => {
			console.log(`Test server running on port ${port}`);
			done();
		});
	});

	afterAll((done) => {
		if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
			clientSocket.close();
		}

		wss.close(() => {
			server.close(done);
		});
	});

	it("should authenticate a client with valid credentials", (done) => {
		// Create client WebSocket
		clientSocket = new WebSocket(serverUrl);

		// Handle connection open
		clientSocket.on("open", () => {
			// Send authentication message
			clientSocket.send(
				JSON.stringify({
					type: MessageType.AUTH,
					apiKey: testApiKey,
					clientId: testClientId,
					timestamp: Date.now(),
				}),
			);
		});

		// Handle messages from server
		clientSocket.on("message", (data: WebSocket.RawData) => {
			const message = JSON.parse(data.toString());

			if (message.type === MessageType.AUTH_RESULT) {
				if (!message.success) {
					done(new Error(`Auth failed: ${message.error}`));
					return;
				}
				expect(message.success).toBe(true);
				expect(message.token).toBeDefined();
				done();
			}
		});

		// Handle errors
		clientSocket.on("error", (error) => {
			done(error);
		});
	});

	it("should reject a client with invalid API key", (done) => {
		// Create client WebSocket
		const badClient = new WebSocket(serverUrl);

		// Handle connection open
		badClient.on("open", () => {
			// Send authentication message with invalid API key
			badClient.send(
				JSON.stringify({
					type: MessageType.AUTH,
					apiKey: "invalid-key",
					clientId: "bad-client",
					timestamp: Date.now(),
				}),
			);
		});

		// Handle messages from server
		badClient.on("message", (data: WebSocket.RawData) => {
			const message = JSON.parse(data.toString());

			if (message.type === MessageType.AUTH_RESULT) {
				expect(message.success).toBe(false);
				expect(message.error).toBeDefined();

				// Close connection
				badClient.close();
				done();
			}
		});

		// Handle errors
		badClient.on("error", (error) => {
			done(error);
		});
	});

	it("should handle ping-pong messages", (done) => {
		// Ensure we have an authenticated client
		if (!clientSocket || clientSocket.readyState !== WebSocket.OPEN) {
			done(new Error("Client not connected and authenticated"));
			return;
		}

		// Send ping message
		clientSocket.send(
			JSON.stringify({
				type: MessageType.PING,
				timestamp: Date.now(),
			}),
		);

		// Handle pong response
		const messageHandler = (data: WebSocket.RawData) => {
			const message = JSON.parse(data.toString());

			if (message.type === MessageType.PONG) {
				// Remove event listener
				clientSocket.off("message", messageHandler);
				done();
			}
		};

		// Add message listener
		clientSocket.on("message", messageHandler);
	});
});
