// LM Studio API compatible types

/**
 * LM Studio/OpenAI API compatible message format
 */
export interface Message {
	role: "system" | "user" | "assistant" | "function";
	content: string;
	name?: string;
}

/**
 * Function call information for function calling
 */
export interface FunctionCall {
	name: string;
	arguments: string;
}

/**
 * Function definition for function calling
 */
export interface FunctionDefinition {
	name: string;
	description?: string;
	parameters: Record<string, any>;
}

/**
 * Request format for chat completions
 */
export interface ChatCompletionRequest {
	model: string;
	messages: Message[];
	temperature?: number;
	top_p?: number;
	n?: number;
	stream?: boolean;
	stop?: string | string[];
	max_tokens?: number;
	presence_penalty?: number;
	frequency_penalty?: number;
	logit_bias?: Record<string, number>;
	functions?: FunctionDefinition[];
	function_call?: "auto" | "none" | { name: string };
}

/**
 * Request format for text completions
 */
export interface CompletionRequest {
	model: string;
	prompt: string | string[];
	suffix?: string;
	temperature?: number;
	top_p?: number;
	n?: number;
	stream?: boolean;
	logprobs?: number;
	echo?: boolean;
	stop?: string | string[];
	presence_penalty?: number;
	frequency_penalty?: number;
	best_of?: number;
	logit_bias?: Record<string, number>;
	max_tokens?: number;
}

/**
 * Request format for embeddings
 */
export interface EmbeddingRequest {
	model: string;
	input: string | string[];
	encoding_format?: "float" | "base64";
}

// Message types for WebSocket communication
export enum MessageType {
	// Authentication
	AUTH = "auth",
	AUTH_RESULT = "auth_result",
	REGISTER = "register",

	// Connection health
	PING = "ping",
	PONG = "pong",

	// API requests
	CHAT_REQUEST = "chat_request",
	COMPLETION_REQUEST = "completion_request",
	EMBEDDINGS_REQUEST = "embeddings_request",
	MODELS_REQUEST = "models_request",
	CANCEL_REQUEST = "cancel_request",

	// API responses
	CHAT_RESPONSE = "chat_response",
	COMPLETION_RESPONSE = "completion_response",
	EMBEDDINGS_RESPONSE = "embeddings_response",
	MODELS_RESPONSE = "models_response",
	RESPONSE = "response",
	STREAM_CHUNK = "stream_chunk",
	STREAM_END = "stream_end",

	// Errors
	ERROR = "error",
	ERROR_RESPONSE = "error_response",
}

// Base message interface
export interface BaseMessage {
	type: MessageType;
	timestamp?: number;
	requestId?: string;
}

// Authentication messages
export interface AuthMessage extends BaseMessage {
	type: MessageType.AUTH;
	apiKey: string;
	clientId: string;
}

export interface AuthResultMessage extends BaseMessage {
	type: MessageType.AUTH_RESULT;
	success: boolean;
	token?: string;
	error?: string;
}

// Request messages
export interface RequestMessage extends BaseMessage {
	requestId: string;
	stream?: boolean;
	data?: any;
}

// Chat request message
export interface ChatRequestMessage extends RequestMessage {
	type: MessageType.CHAT_REQUEST;
}

// Completion request message
export interface CompletionRequestMessage extends RequestMessage {
	type: MessageType.COMPLETION_REQUEST;
}

// Embeddings request message
export interface EmbeddingsRequestMessage extends RequestMessage {
	type: MessageType.EMBEDDINGS_REQUEST;
}

// Models request message
export interface ModelsRequestMessage extends RequestMessage {
	type: MessageType.MODELS_REQUEST;
}

// Cancel request message
export interface CancelRequestMessage extends BaseMessage {
	type: MessageType.CANCEL_REQUEST;
	requestId: string;
}

// Response messages
export interface ResponseMessage extends BaseMessage {
	requestId: string;
	data?: any;
	error?: any;
	stream?: boolean;
}

// Chat response message
export interface ChatResponseMessage extends ResponseMessage {
	type: MessageType.CHAT_RESPONSE;
}

// Completion response message
export interface CompletionResponseMessage extends ResponseMessage {
	type: MessageType.COMPLETION_RESPONSE;
}

// Embeddings response message
export interface EmbeddingsResponseMessage extends ResponseMessage {
	type: MessageType.EMBEDDINGS_RESPONSE;
}

// Models response message
export interface ModelsResponseMessage extends ResponseMessage {
	type: MessageType.MODELS_RESPONSE;
}

// Error message
export interface ErrorMessage extends BaseMessage {
	type: MessageType.ERROR;
	error: string;
}

// Error response message
export interface ErrorResponseMessage extends BaseMessage {
	type: MessageType.ERROR_RESPONSE;
	requestId: string;
	error: any;
}

// Streaming messages
export interface StreamChunkMessage extends BaseMessage {
	type: MessageType.STREAM_CHUNK;
	requestId: string;
	data: string;
}

export interface StreamEndMessage extends BaseMessage {
	type: MessageType.STREAM_END;
	requestId: string;
}

// Union types for client and server messages
export type ClientMessage =
	| AuthMessage
	| ChatResponseMessage
	| CompletionResponseMessage
	| EmbeddingsResponseMessage
	| ModelsResponseMessage
	| ErrorResponseMessage
	| StreamChunkMessage
	| StreamEndMessage
	| BaseMessage;

export type ServerMessage =
	| AuthResultMessage
	| ChatRequestMessage
	| CompletionRequestMessage
	| EmbeddingsRequestMessage
	| ModelsRequestMessage
	| CancelRequestMessage
	| ErrorMessage
	| StreamChunkMessage
	| StreamEndMessage
	| BaseMessage;
