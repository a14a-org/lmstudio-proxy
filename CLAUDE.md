# lmstudio-proxy

Secure proxy system for LM Studio with client/server architecture.

## Stack

- Bun runtime, TypeScript
- Monorepo with Bun workspaces (`packages/*`)
- Biome for linting/formatting

## Commands

- `bun run build` - build all packages (common -> client -> server)
- `bun run test` - run all tests
- `bun run server` - start proxy server
- `bun run client` - start client
- `bun run lint` - check with Biome
- `bun run test:integration` - run integration tests

## Structure

- `packages/common/` - shared types and utilities
- `packages/client/` - proxy client
- `packages/server/` - proxy server
- `packages/test/` - integration tests
