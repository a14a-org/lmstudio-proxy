FROM node:20-alpine AS build

# Create app directory
WORKDIR /app

# Install global dependencies
RUN npm install -g yarn

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./
COPY packages/server/package.json ./packages/server/
COPY packages/common/package.json ./packages/common/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript code
RUN yarn build

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

# Expose the port the server listens on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "packages/server/dist/index.js"] 