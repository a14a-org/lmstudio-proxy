import path from "node:path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface ServerConfig {
	// Server configuration
	port: number;
	host: string;
	nodeEnv: string;

	// WebSocket configuration
	wsPath: string;
	wsPingIntervalMs: number;

	// Security
	apiKey: string;
	jwtSecret: string;
	jwtExpiresIn: string;

	// Logging
	logLevel: string;

	// Feature flags
	enableStreaming: boolean;
}

export const config: ServerConfig = {
	// Server configuration
	port: parseInt(process.env.PORT || "3000", 10),
	host: process.env.HOST || "0.0.0.0",
	nodeEnv: process.env.NODE_ENV || "development",

	// WebSocket configuration
	wsPath: process.env.WS_PATH || "/ws",
	wsPingIntervalMs: parseInt(process.env.WS_PING_INTERVAL_MS || "30000", 10),

	// Security
	apiKey: process.env.API_KEY || "",
	jwtSecret: process.env.JWT_SECRET || "",
	jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",

	// Logging
	logLevel: process.env.LOG_LEVEL || "info",

	// Feature flags - defaults to enabled
	enableStreaming: process.env.ENABLE_STREAMING !== "false",
};

export function validateConfig(): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Required fields
	if (!config.apiKey) errors.push("API_KEY is required");
	if (!config.jwtSecret) errors.push("JWT_SECRET is required");

	// Validation rules
	if (config.port <= 0 || config.port > 65535)
		errors.push("PORT must be between 1 and 65535");
	if (config.wsPingIntervalMs < 1000)
		errors.push("WS_PING_INTERVAL_MS must be at least 1000");

	return {
		valid: errors.length === 0,
		errors,
	};
}
