import { config } from "../config";

// Simple log levels
export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

// Map string log levels to enum
const logLevelMap: Record<string, LogLevel> = {
	debug: LogLevel.DEBUG,
	info: LogLevel.INFO,
	warn: LogLevel.WARN,
	error: LogLevel.ERROR,
};

// Get configured log level
const configuredLevel =
	logLevelMap[config.logLevel.toLowerCase()] || LogLevel.INFO;

/**
 * Logger interface
 */
export interface Logger {
	debug(message: string, ...args: any[]): void;
	info(message: string, ...args: any[]): void;
	warn(message: string, ...args: any[]): void;
	error(message: string, ...args: any[]): void;
}

/**
 * Create a logger for a specific module
 */
export function createLogger(module: string): Logger {
	return {
		debug(message: string, ...args: any[]) {
			if (configuredLevel <= LogLevel.DEBUG) {
				console.debug(`[DEBUG] [${module}] ${message}`, ...args);
			}
		},

		info(message: string, ...args: any[]) {
			if (configuredLevel <= LogLevel.INFO) {
				console.info(`[INFO] [${module}] ${message}`, ...args);
			}
		},

		warn(message: string, ...args: any[]) {
			if (configuredLevel <= LogLevel.WARN) {
				console.warn(`[WARN] [${module}] ${message}`, ...args);
			}
		},

		error(message: string, ...args: any[]) {
			if (configuredLevel <= LogLevel.ERROR) {
				console.error(`[ERROR] [${module}] ${message}`, ...args);
			}
		},
	};
}
