import express from "express";
import { config } from "../../config";
import { createLogger } from "../../utils/logger";
import {
	chatCompletionHandler,
	chatCompletionStreamHandler,
} from "../controllers/chat";

const logger = createLogger("chat-routes");
const router = express.Router();

// Chat completions endpoint (streaming and non-streaming)
router.post("/completions", async (req, res, next) => {
	try {
		logger.debug("Received chat completion request", {
			model: req.body.model,
			stream: req.body.stream === true,
			streamingEnabled: config.enableStreaming,
		});

		// Check if streaming is requested and enabled
		const streamRequested = req.body.stream === true;
		const streamingEnabled = config.enableStreaming;

		if (streamRequested && !streamingEnabled) {
			logger.info(
				"Streaming requested but disabled by configuration - falling back to non-streaming",
			);
			// Force non-streaming mode by setting stream to false
			req.body.stream = false;
			return chatCompletionHandler(req, res, next);
		} else if (streamRequested && streamingEnabled) {
			// Handle streaming response
			return chatCompletionStreamHandler(req, res, next);
		} else {
			// Handle non-streaming response
			return chatCompletionHandler(req, res, next);
		}
	} catch (error) {
		next(error);
	}
});

export default router;
