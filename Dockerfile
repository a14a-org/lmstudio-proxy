FROM node:20-alpine AS build

# Create app directory
WORKDIR /app

# Copy package.json files for all workspaces
COPY package.json yarn.lock ./
COPY packages/server/package.json ./packages/server/
COPY packages/common/package.json ./packages/common/
COPY packages/client/package.json ./packages/client/
COPY packages/test/package.json ./packages/test/

# Create necessary directory structure
RUN mkdir -p packages/server/src packages/common/src packages/client/src packages/test/src

# Copy tsconfig files
COPY tsconfig.json ./
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/client/tsconfig.json ./packages/client/
COPY packages/test/tsconfig.json ./packages/test/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the common package first
RUN cd packages/common && yarn build

# Then build the server package
RUN cd packages/server && yarn build

# Remove development dependencies
RUN yarn install --production --ignore-scripts --prefer-offline

# Production image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV WS_PATH=/ws
ENV WS_PING_INTERVAL_MS=30000
ENV LOG_LEVEL=info

# Copy built node modules and compiled TypeScript
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/common/dist ./packages/common/dist
COPY --from=build /app/packages/server/package.json ./packages/server/
COPY --from=build /app/packages/common/package.json ./packages/common/
COPY --from=build /app/package.json ./

# Install wget for health checks
RUN apk --no-cache add curl

# Expose the port the server listens on
EXPOSE 3000

# Health check - using curl with IPv4 instead of wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f --ipv4 http://127.0.0.1:3000/health || exit 1

# Start the server
CMD ["node", "packages/server/dist/index.js"] 