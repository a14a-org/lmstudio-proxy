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

## License

MIT
