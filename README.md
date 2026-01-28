# LM Studio Proxy

A secure proxy system that allows remote API access to a local LM Studio instance through WebSocket communication.

## Features

- Secure authentication with JWT tokens and API keys
- Streaming response support for real-time completions
- Automatic reconnection with configurable intervals
- OpenAI-compatible API format
- Support for all LM Studio endpoints (completions, chat, embeddings)
- Rate limiting and error handling middleware
- Health check endpoints for monitoring

## Tech Stack

- **Runtime**: Node.js 20+, Bun
- **Language**: TypeScript
- **Server Framework**: Express 5
- **WebSocket**: ws
- **HTTP Client**: Axios (client package)
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Zod
- **Testing**: Jest
- **Linting**: ESLint, Prettier

## Architecture

This monorepo consists of three packages:

| Package | Description |
|---------|-------------|
| `@lmstudio-proxy/common` | Shared types, utilities, and constants |
| `@lmstudio-proxy/client` | Local proxy client that connects to LM Studio |
| `@lmstudio-proxy/server` | Remote API server with WebSocket support |

## Getting Started

### Prerequisites

- Node.js 20+
- Bun
- LM Studio running locally

### Installation

```bash
bun install
```

### Build

```bash
bun run build
```

## Environment Variables

### Server (`@lmstudio-proxy/server`)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `HOST` | Server host | `0.0.0.0` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `API_KEY` | API key for authentication | - | Yes |
| `JWT_SECRET` | Secret for JWT signing | - | Yes |
| `JWT_EXPIRES_IN` | JWT token expiration | `24h` | No |
| `WS_PATH` | WebSocket endpoint path | `/ws` | No |
| `WS_PING_INTERVAL_MS` | WebSocket ping interval | `30000` | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` | No |
| `ENABLE_STREAMING` | Enable streaming responses | `true` | No |

### Client (`@lmstudio-proxy/client`)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REMOTE_SERVER_URL` | Remote proxy server WebSocket URL | - | Yes |
| `API_KEY` | API key for authentication | - | Yes |
| `CLIENT_ID` | Unique client identifier | - | Yes |
| `LM_STUDIO_HOST` | Local LM Studio host | `localhost` | No |
| `LM_STUDIO_PORT` | Local LM Studio port | `1234` | No |
| `HEALTH_CHECK_PORT` | Health check endpoint port | `3001` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `RECONNECT_INTERVAL` | Reconnection interval (ms) | `5000` | No |

## Scripts

| Script | Description |
|--------|-------------|
| `bun run build` | Build all packages |
| `bun run clean` | Clean build artifacts |
| `bun run test` | Run tests for all packages |
| `bun run lint` | Run ESLint |
| `bun run lint:fix` | Run ESLint with auto-fix |
| `bun run format` | Format code with Prettier |
| `bun run format:check` | Check code formatting |
| `bun run server` | Start the remote API server |
| `bun run client` | Start the local proxy client |
| `bun run test:integration` | Run integration tests |
| `bun run test:server` | Run server tests |
| `bun run test:client` | Run client tests |

## License

MIT
