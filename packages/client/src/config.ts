import path from "node:path";
import {
	DEFAULT_LM_STUDIO_HOST,
	DEFAULT_LM_STUDIO_PORT,
} from "@lmstudio-proxy/common";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface ClientConfig {
	// Remote server configuration
	remoteServerUrl: string;
	apiKey: string;
	clientId: string;

	// Local LM Studio configuration
	lmStudioHost: string;
	lmStudioPort: number;

	// Local proxy configuration
	healthCheckPort: number;
	logLevel: string;
	reconnectInterval: number;
}

// Configuration with defaults and environment variable overrides
export const config: ClientConfig = {
	// Remote server configuration
	remoteServerUrl:
		process.env.REMOTE_SERVER_URL || "wss://api.example.com/proxy",
	apiKey: process.env.API_KEY || "",
	clientId: process.env.CLIENT_ID || "",

	// Local LM Studio configuration
	lmStudioHost: process.env.LM_STUDIO_HOST || DEFAULT_LM_STUDIO_HOST,
	lmStudioPort: parseInt(
		process.env.LM_STUDIO_PORT || String(DEFAULT_LM_STUDIO_PORT),
		10,
	),

	// Local proxy configuration
	healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || "3001", 10),
	logLevel: process.env.LOG_LEVEL || "info",
	reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || "5000", 10),
};

// Validate critical configuration
export function validateConfig(): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!config.remoteServerUrl) {
		errors.push("REMOTE_SERVER_URL must be provided in .env file");
	}

	if (!config.apiKey) {
		errors.push("API_KEY must be provided in .env file");
	}

	if (!config.clientId) {
		errors.push("CLIENT_ID must be provided in .env file");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
