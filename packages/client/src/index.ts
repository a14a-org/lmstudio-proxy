import express from "express";
import { config, validateConfig } from "./config";
import { ConnectionEvent, ProxyConnection } from "./proxy-connection";
import { createLogger } from "./utils/logger";

const logger = createLogger("main");

/**
 * Main entry point for the LM Studio Proxy Client
 */
async function main() {
	// Log startup message
	logger.info("Starting LM Studio Proxy Client...");

	// Validate configuration
	const { valid, errors } = validateConfig();
	if (!valid) {
		logger.error("Invalid configuration:", errors);
		process.exit(1);
	}

	// Initialize proxy connection
	const connection = new ProxyConnection();

	// Set up connection event handlers
	connection.on(ConnectionEvent.CONNECTED, () => {
		logger.info("Connected to remote server");
	});

	connection.on(ConnectionEvent.DISCONNECTED, (data) => {
		logger.info(`Disconnected from remote server: ${data.code} ${data.reason}`);
	});

	connection.on(ConnectionEvent.AUTHENTICATED, () => {
		logger.info("Successfully authenticated with remote server");
	});

	connection.on(ConnectionEvent.AUTH_FAILED, (error) => {
		logger.error(`Authentication failed: ${error}`);
		process.exit(1);
	});

	connection.on(ConnectionEvent.ERROR, (error) => {
		logger.error("Connection error:", error);
	});

	// Connect to the remote server
	connection.connect();

	// Set up health check HTTP server
	const app = express();

	app.get("/health", (_req, res) => {
		const status = {
			status: "ok",
			connected: connection.isConnected(),
			authenticated: connection.isAuthenticated(),
			timestamp: new Date().toISOString(),
		};

		res.json(status);
	});

	app.get("/", (_req, res) => {
		res.send("LM Studio Proxy Client");
	});

	// Debug endpoint for testing stream messages
	app.get("/debug/test-stream", (req, res) => {
		try {
			// Extract optional requestId from query params
			const requestId =
				(req.query.requestId as string) || `test_stream_${Date.now()}`;

			logger.info(`Received test stream request with ID: ${requestId}`);

			// Call the test function
			connection.testStreamMessage(requestId);

			res.json({
				status: "ok",
				message: "Test stream message sent",
				requestId,
			});
		} catch (error) {
			logger.error("Error in test stream endpoint:", {
				error: error instanceof Error ? error.message : String(error),
				timestamp: new Date().toISOString(),
			});

			res.status(500).json({
				status: "error",
				message: "Failed to send test stream message",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});

	// Start HTTP server
	const server = app.listen(config.healthCheckPort, () => {
		logger.info(
			`Health check server running on port ${config.healthCheckPort}`,
		);
	});

	// Handle process termination
	process.on("SIGINT", () => handleShutdown(connection, server));
	process.on("SIGTERM", () => handleShutdown(connection, server));
}

/**
 * Handle graceful shutdown
 */
function handleShutdown(connection: ProxyConnection, server: any) {
	logger.info("Shutting down...");

	// Disconnect from remote server
	connection.disconnect();

	// Close HTTP server
	server.close(() => {
		logger.info("HTTP server closed");
		process.exit(0);
	});

	// Force exit after timeout
	setTimeout(() => {
		logger.error("Forced shutdown after timeout");
		process.exit(1);
	}, 5000);
}

// Start the application
main().catch((error) => {
	logger.error("Fatal error:", error);
	process.exit(1);
});
