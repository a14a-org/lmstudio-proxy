// import { v4 as uuidv4 } from 'uuid';
import type { BaseMessage, MessageType } from "./types";

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create a message with the given type and data
 */
export function createMessage<T extends BaseMessage>(
	type: MessageType,
	data: Partial<T> & Record<string, any> = {},
): T {
	return {
		type,
		timestamp: Date.now(),
		...data,
	} as T;
}

/**
 * Validate required configuration values
 * @param config Configuration object
 * @param requiredKeys Array of required keys
 * @returns Object with validation result and error messages
 */
export function validateConfig<T>(
	config: T,
	requiredKeys: (keyof T)[],
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	for (const key of requiredKeys) {
		const value = config[key];
		if (value === undefined || value === null || value === "") {
			errors.push(`${String(key)} is required`);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Parse stringified JSON safely
 * @param data Data to parse
 * @param defaultValue Default value if parsing fails
 * @returns Parsed object or default value
 */
export function safeJsonParse<T>(data: string, defaultValue?: T): T {
	try {
		return JSON.parse(data) as T;
	} catch {
		return defaultValue as T;
	}
}

/**
 * Check if a value is null or undefined
 */
export function isNullOrUndefined(value: any): value is null | undefined {
	return value === null || value === undefined;
}

/**
 * Delay execution for a specified time
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format error message for logging and response
 * @param error Error object or string
 * @returns Formatted error object
 */
export function formatError(error: unknown): {
	message: string;
	stack?: string;
} {
	if (error instanceof Error) {
		return {
			message: error.message,
			stack: error.stack,
		};
	}

	if (typeof error === "string") {
		return { message: error };
	}

	return { message: "Unknown error" };
}

/**
 * Check if a value is a valid WebSocket code
 * @param code Value to check
 * @returns Boolean indicating if code is valid
 */
export function isValidWebSocketCode(code: number): boolean {
	// Valid codes are 1000 or in range 3000-4999
	return code === 1000 || (code >= 3000 && code <= 4999);
}

/**
 * Convert milliseconds to a human-readable duration
 * @param ms Milliseconds
 * @returns Human-readable duration
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}

	const seconds = Math.floor(ms / 1000) % 60;
	const minutes = Math.floor(ms / (1000 * 60)) % 60;
	const hours = Math.floor(ms / (1000 * 60 * 60));

	if (hours > 0) {
		return `${hours}h ${minutes}m ${seconds}s`;
	}

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}
