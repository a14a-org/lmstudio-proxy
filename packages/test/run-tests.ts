import { type ChildProcess, spawn } from "node:child_process";
import * as path from "node:path";

// Configuration
const CONFIG = {
	serverPort: process.env.SERVER_PORT || "3000",
	apiKey: process.env.API_KEY || "test-api-key",
	clientId: process.env.CLIENT_ID || `test-client-${Date.now()}`,
	verbose: process.env.VERBOSE === "true",
	timeout: parseInt(process.env.TEST_TIMEOUT || "30000", 10),
};

// Track child processes
let serverProcess: ChildProcess | null = null;
let clientProcess: ChildProcess | null = null;

// Start the test server
function startServer(): Promise<void> {
	return new Promise((resolve) => {
		console.log("\n=== Starting test server ===\n");

		const env = {
			...process.env,
			PORT: CONFIG.serverPort,
			API_KEY: CONFIG.apiKey,
			VERBOSE: CONFIG.verbose ? "true" : "false",
		};

		serverProcess = spawn("ts-node", [path.join(__dirname, "test-server.ts")], {
			env,
		});

		if (!serverProcess || !serverProcess.stdout || !serverProcess.stderr) {
			throw new Error("Failed to start server process");
		}

		serverProcess.stdout.on("data", (data) => {
			const output = data.toString();
			console.log(`[Server] ${output}`);

			// Resolve when server is ready
			if (output.includes("Test server running on port")) {
				resolve();
			}
		});

		serverProcess.stderr.on("data", (data) => {
			console.error(`[Server Error] ${data.toString()}`);
		});

		serverProcess.on("close", (code) => {
			console.log(`Server process exited with code ${code}`);
		});
	});
}

// Start the test client
function startClient(): Promise<void> {
	return new Promise((resolve) => {
		console.log("\n=== Starting test client ===\n");

		const env = {
			...process.env,
			SERVER_URL: `ws://localhost:${CONFIG.serverPort}/ws`,
			API_KEY: CONFIG.apiKey,
			CLIENT_ID: CONFIG.clientId,
			VERBOSE: CONFIG.verbose ? "true" : "false",
		};

		clientProcess = spawn("ts-node", [path.join(__dirname, "test-client.ts")], {
			env,
		});

		if (!clientProcess || !clientProcess.stdout || !clientProcess.stderr) {
			throw new Error("Failed to start client process");
		}

		clientProcess.stdout.on("data", (data) => {
			const output = data.toString();
			console.log(`[Client] ${output}`);

			// Resolve when client is authenticated
			if (output.includes("Successfully authenticated with server")) {
				resolve();
			}
		});

		clientProcess.stderr.on("data", (data) => {
			console.error(`[Client Error] ${data.toString()}`);
		});

		clientProcess.on("close", (code) => {
			console.log(`Client process exited with code ${code}`);
		});
	});
}

// Gracefully shutdown all processes
function shutdown(): void {
	console.log("\n=== Shutting down test processes ===\n");

	if (clientProcess) {
		clientProcess.kill();
	}

	if (serverProcess) {
		serverProcess.kill();
	}
}

// Handle process termination
process.on("SIGINT", () => {
	shutdown();
	process.exit(0);
});

process.on("SIGTERM", () => {
	shutdown();
	process.exit(0);
});

// Run tests
async function runTests(): Promise<void> {
	try {
		// Start server
		await startServer();

		// Start client
		await startClient();

		// Wait for tests to complete
		console.log("\n=== Tests in progress ===\n");

		// Set a timeout to end the test
		setTimeout(() => {
			console.log("\n=== Tests completed ===\n");
			shutdown();
			process.exit(0);
		}, CONFIG.timeout);
	} catch (error) {
		console.error("Error running tests:", error);
		shutdown();
		process.exit(1);
	}
}

// Start tests
console.log("=== LM Studio Proxy Integration Tests ===");
console.log(`Server Port: ${CONFIG.serverPort}`);
console.log(`API Key: ${CONFIG.apiKey}`);
console.log(`Client ID: ${CONFIG.clientId}`);
console.log(`Verbose Mode: ${CONFIG.verbose}`);
console.log(`Test Timeout: ${CONFIG.timeout}ms`);

runTests();
