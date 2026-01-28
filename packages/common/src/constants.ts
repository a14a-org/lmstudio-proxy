/**
 * Default LM Studio API configuration
 */
export const DEFAULT_LM_STUDIO_HOST = "localhost";
export const DEFAULT_LM_STUDIO_PORT = 1234;
export const LM_STUDIO_API_PATH = "/v1";

/**
 * WebSocket configuration
 */
export const WS_PING_INTERVAL = 30000; // 30 seconds
export const WS_RECONNECT_INTERVAL = 5000; // 5 seconds

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
	CHAT_COMPLETIONS: "/chat/completions",
	COMPLETIONS: "/completions",
	EMBEDDINGS: "/embeddings",
	MODELS: "/models",
};

/**
 * WebSocket events
 */
export const WS_EVENTS = {
	OPEN: "open",
	MESSAGE: "message",
	CLOSE: "close",
	ERROR: "error",
	PONG: "pong",
};

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
	OK: 200,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	INTERNAL_SERVER_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
};

/**
 * Error codes
 */
export enum ErrorCode {
	AUTHENTICATION_FAILED = "authentication_failed",
	INVALID_REQUEST = "invalid_request",
	PROXY_UNAVAILABLE = "proxy_unavailable",
	LM_STUDIO_UNAVAILABLE = "lm_studio_unavailable",
	RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
	INTERNAL_ERROR = "internal_error",
}

/**
 * Rate limiting
 */
export const DEFAULT_RATE_LIMIT = {
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
};

/**
 * Authentication
 */
export const JWT_EXPIRY = "24h";

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
	UNAUTHORIZED: "Unauthorized access",
	INVALID_API_KEY: "Invalid API key",
	NO_CLIENTS: "No available LM Studio clients",
	REQUEST_TIMEOUT: "Request timeout",
	INVALID_REQUEST: "Invalid request format",
	SERVER_ERROR: "Internal server error",
};
