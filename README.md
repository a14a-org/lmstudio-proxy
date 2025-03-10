# LM Studio Proxy

A secure proxy system that allows remote API access to a local LM Studio instance.

## Architecture

This project consists of two main components:

1. **Local Proxy Client**: Runs on the same machine as LM Studio and communicates with the local LM Studio API
2. **Remote API Server**: Provides a secure, authenticated API that remote clients can access

Communication between the remote server and local client uses WebSockets for bidirectional streaming support.

## Features

- Secure authentication for API requests
- Streaming response support
- Connection resilience with automatic reconnection
- Compatible with OpenAI API format
- Support for all LM Studio endpoints (completions, chat, embeddings)

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn
- LM Studio running locally

### Installation

```bash
# Clone the repository
git clone https://github.com/a14a-org/lmstudio-proxy.git
cd lmstudio-proxy

# Install dependencies
yarn install

# Build all packages
yarn build
```

### Local Proxy Client Setup

1. Configure your client settings:

   ```bash
   cd packages/client
   cp .env.example .env
   # Edit .env with your settings
   ```

2. Start the local proxy client:
   ```bash
   yarn start
   ```

### Remote Server Setup

1. Configure your server settings:

   ```bash
   cd packages/server
   cp .env.example .env
   # Edit .env with your settings
   ```

2. Start the server:
   ```bash
   yarn start
   ```

## Deployment on Coolify

The LM Studio Proxy server can be easily deployed using Coolify. This repository includes all necessary configurations for a seamless deployment.

### Prerequisites

- A running Coolify instance
- Access to your Coolify dashboard

### Deployment Steps

1. In Coolify, create a new service from a Git repository
2. Connect to the LM Studio Proxy repository (https://github.com/a14a-org/lmstudio-proxy)
3. Select "Docker" as the build method
4. The Docker configuration will be automatically detected from the `coolify.json` file
5. Set the required environment variables in Coolify:
   - `API_KEY`: Your chosen API key for authentication
   - `JWT_SECRET`: A secure random string for JWT token signing
6. Deploy the service

### Configuration Options

You can adjust the following environment variables in Coolify:

- `PORT`: The port the server will listen on (default: 3000)
- `LOG_LEVEL`: Logging detail level (debug, info, warn, error)
- `WS_PATH`: WebSocket endpoint path
- `JWT_EXPIRES_IN`: JWT token expiration time

### Verification

Once deployed, you can verify the server is running by accessing the health endpoint at `https://your-deployment-url/health`

## License

MIT
