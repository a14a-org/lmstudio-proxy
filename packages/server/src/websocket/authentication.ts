import { MessageType } from "@lmstudio-proxy/common";
import jwt from "jsonwebtoken";
import type WebSocket from "ws";
import { config } from "../config";
import { createLogger } from "../utils/logger";
import type { ClientManager } from "./client-manager";

const logger = createLogger("ws-auth");

// Define extended WebSocket type
interface ExtendedWebSocket extends WebSocket {
	isAlive: boolean;
	isAuthenticated: boolean;
	clientId: string;
}

/**
 * Handle client authentication messages
 */
export function handleClientAuthentication(
	ws: ExtendedWebSocket,
	message: any,
	clientManager: ClientManager,
): void {
	if (message.type !== MessageType.AUTH) {
		// If first message is not authentication, close connection
		logger.warn("Client sent non-auth message before authentication");
		ws.send(
			JSON.stringify({
				type: MessageType.ERROR,
				error: "Authentication required",
			}),
		);
		ws.close(1008, "Authentication required");
		return;
	}

	// Validate api key
	if (message.apiKey !== config.apiKey) {
		logger.warn("Client authentication failed: invalid API key");
		ws.send(
			JSON.stringify({
				type: MessageType.AUTH_RESULT,
				success: false,
				error: "Invalid API key",
			}),
		);
		ws.close(1008, "Authentication failed");
		return;
	}

	// Validate client ID
	if (!message.clientId) {
		logger.warn("Client authentication failed: missing client ID");
		ws.send(
			JSON.stringify({
				type: MessageType.AUTH_RESULT,
				success: false,
				error: "Client ID required",
			}),
		);
		ws.close(1008, "Authentication failed");
		return;
	}

	// Generate JWT token for this session
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-expect-error - Temporary fix for type issues with jsonwebtoken
	const token = jwt.sign({ clientId: message.clientId }, config.jwtSecret, {
		expiresIn: config.jwtExpiresIn,
	});

	// Register client
	clientManager.addClient(message.clientId, ws);

	// Send successful authentication response
	ws.send(
		JSON.stringify({
			type: MessageType.AUTH_RESULT,
			success: true,
			token,
		}),
	);

	logger.info(`Client authenticated: ${message.clientId}`);
}
