import WebSocket from "ws";

// Configuration
const CONFIG = {
	serverUrl: process.env.SERVER_URL || "ws://localhost:3000/ws",
	apiKey: process.env.API_KEY || "test-api-key",
	clientId: process.env.CLIENT_ID || `stream-test-client-${Date.now()}`,
	verbose: true,
};

// Status variables
let ws: WebSocket | null = null;

// Track test streams
const pendingStreams = new Map<
	string,
	{
		receivedChunks: number;
		receivedEnd: boolean;
	}
>();

// Connect to the server
function connect(): void {
	console.log(`Connecting to ${CONFIG.serverUrl}...`);

	ws = new WebSocket(CONFIG.serverUrl);

	ws.on("open", handleOpen);
	ws.on("message", handleMessage);
	ws.on("close", handleClose);
	ws.on("error", handleError);
}

// Handle WebSocket open event
function handleOpen(): void {
	console.log("Connection established");

	// Send authentication message
	sendAuthentication();
}

// Send authentication message
function sendAuthentication(): void {
	console.log("Sending authentication...");

	send({
		type: "auth",
		apiKey: CONFIG.apiKey,
		clientId: CONFIG.clientId,
		timestamp: Date.now(),
	});
}

// Handle WebSocket message event
function handleMessage(data: WebSocket.Data): void {
	try {
		const message = JSON.parse(data.toString());
		console.log(`Received message of type: ${message.type}`);

		switch (message.type) {
			case "auth_result":
				handleAuthResult(message);
				break;
			case "error":
				console.error(`Error from server: ${message.error}`);
				break;
			case "stream_chunk":
				handleStreamChunk(message);
				break;
			case "stream_end":
				handleStreamEnd(message);
				break;
			default:
				console.log(`Unhandled message type: ${message.type}`);
		}
	} catch (error) {
		console.error("Error handling message:", error);
	}
}

// Handle authentication result
function handleAuthResult(message: any): void {
	if (message.success) {
		console.log("Successfully authenticated with server");

		// Start test sequence after authentication
		setTimeout(runStreamTests, 500);
	} else {
		console.error(`Authentication failed: ${message.error}`);
	}
}

// Handle WebSocket close event
function handleClose(code: number, reason: string): void {
	console.log(`Connection closed: ${code} - ${reason}`);
}

// Handle WebSocket error event
function handleError(error: Error): void {
	console.error("WebSocket error:", error);
}

// Send a message to the server
function send(message: any): boolean {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		console.error("Cannot send message: WebSocket is not open");
		return false;
	}

	try {
		const messageStr = JSON.stringify(message);
		console.log(`Sending message: ${messageStr}`);
		ws.send(messageStr);
		return true;
	} catch (error) {
		console.error("Error sending message:", error);
		return false;
	}
}

// Handle stream chunk message
function handleStreamChunk(message: any): void {
	const { requestId, data } = message;
	console.log(`Received stream chunk for request ${requestId}`);

	if (!pendingStreams.has(requestId)) {
		pendingStreams.set(requestId, {
			receivedChunks: 0,
			receivedEnd: false,
		});
	}

	const stream = pendingStreams.get(requestId)!;
	stream.receivedChunks++;

	console.log(`Stream ${requestId}: chunk #${stream.receivedChunks}`);
	try {
		// Try to parse the data as JSON
		const parsedData = JSON.parse(data);
		console.log("Parsed data:", JSON.stringify(parsedData, null, 2));
	} catch {
		console.log("Raw data (first 100 chars):", data.substring(0, 100));
	}
}

// Handle stream end message
function handleStreamEnd(message: any): void {
	const { requestId } = message;
	console.log(`Received stream end for request ${requestId}`);

	if (!pendingStreams.has(requestId)) {
		console.log(`Warning: Received end for unknown stream ${requestId}`);
		return;
	}

	const stream = pendingStreams.get(requestId)!;
	stream.receivedEnd = true;

	console.log(
		`Stream ${requestId} complete: received ${stream.receivedChunks} chunks`,
	);

	// Test complete, clean up
	pendingStreams.delete(requestId);
}

// Run stream tests
function runStreamTests(): void {
	console.log("\n=== Running stream tests ===\n");

	// Test 1: Send a stream chunk followed by a stream end
	const testId = `test-stream-${Date.now()}`;
	console.log(`Test 1: Sending stream messages with ID ${testId}`);

	// Track this test
	pendingStreams.set(testId, {
		receivedChunks: 0,
		receivedEnd: false,
	});

	// Send a stream chunk
	const chunkMessage = {
		type: "stream_chunk",
		requestId: testId,
		data: JSON.stringify({
			id: `test-${testId}`,
			choices: [
				{
					delta: { content: "This is a test streaming message!" },
				},
			],
		}),
		timestamp: Date.now(),
	};

	send(chunkMessage);

	// Send stream end after a delay
	setTimeout(() => {
		const endMessage = {
			type: "stream_end",
			requestId: testId,
			timestamp: Date.now(),
		};

		send(endMessage);
	}, 1000);
}

// Start execution
console.log("Starting stream message test");
console.log(`Server URL: ${CONFIG.serverUrl}`);
console.log(`Client ID: ${CONFIG.clientId}`);
connect();
