import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { ApiError } from "../utils/error";
import { createLogger } from "../utils/logger";

const logger = createLogger("auth-middleware");

// Extend Express Request to include user property
declare global {
	namespace Express {
		interface Request {
			user?: any;
		}
	}
}

export function authMiddleware(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	try {
		// Get auth header
		const authHeader = req.headers.authorization;

		if (!authHeader) {
			throw new ApiError(401, "Authorization header missing");
		}

		// Check auth type (Bearer or API key format)
		if (authHeader.startsWith("Bearer ")) {
			// JWT token authentication
			const token = authHeader.split(" ")[1];

			try {
				const decoded = jwt.verify(token, config.jwtSecret);
				req.user = decoded;
				next();
			} catch {
				logger.warn("Invalid JWT token");
				throw new ApiError(401, "Invalid or expired token");
			}
		} else {
			// Direct API key authentication
			const apiKey = authHeader.replace("Bearer ", "");

			if (apiKey !== config.apiKey) {
				logger.warn("Invalid API key");
				throw new ApiError(401, "Invalid API key");
			}

			req.user = { apiKey: true };
			next();
		}
	} catch (error) {
		if (error instanceof ApiError) {
			next(error);
		} else {
			next(new ApiError(500, "Authentication error"));
		}
	}
}
