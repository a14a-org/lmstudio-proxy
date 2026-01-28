import { config } from "../config";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

export function createLogger(component: string) {
	const currentLevel =
		LOG_LEVELS[config.logLevel as LogLevel] || LOG_LEVELS.info;

	function logWithLevel(level: LogLevel, message: string, ...args: any[]) {
		if (LOG_LEVELS[level] >= currentLevel) {
			const timestamp = new Date().toISOString();
			const prefix = `[${timestamp}] [${level.toUpperCase()}] [${component}]`;

			// eslint-disable-next-line no-console
			console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
				`${prefix} ${message}`,
				...args,
			);
		}
	}

	return {
		debug: (message: string, ...args: any[]) =>
			logWithLevel("debug", message, ...args),
		info: (message: string, ...args: any[]) =>
			logWithLevel("info", message, ...args),
		warn: (message: string, ...args: any[]) =>
			logWithLevel("warn", message, ...args),
		error: (message: string, ...args: any[]) =>
			logWithLevel("error", message, ...args),
	};
}
