# Architecture

## Layers

### `packages/core`

Shared runtime surface for every MCP server:

- environment config loading
- JSON logger
- HTTP bridge client
- HTTP MCP bootstrap
- plugin/tool registration contracts

New integrations should depend on this package rather than creating ad hoc MCP bootstrap code.

### `packages/bridge-contracts`

Shared Zod schemas and TypeScript contracts for bridge RPC calls. The Apple Mail server and the macOS bridge both depend on this package so request/response formats stay aligned.

### `packages/host-bridge-macos`

Local helper service for macOS-only automation. It is intentionally not an MCP server. Its job is to:

- authenticate local calls
- invoke explicit Apple Mail operations
- normalize Apple Mail responses into stable JSON
- return typed bridge errors

Future host-integrated tools such as Finder or Calendar should add more explicit handlers here or in sibling bridge packages, rather than teaching the MCP servers how to talk to Apple Events directly.

### `servers/apple-mail`

HTTP MCP server package that exposes Apple Mail tools under the `mail.*` namespace and delegates all host automation to the macOS bridge.

## Adding another server

Recommended pattern:

1. Add request/response schemas to `packages/bridge-contracts` or a new contracts package if the surface is large.
2. Add or extend a host bridge package with explicit host-side operations.
3. Create a new package under `servers/*`.
4. Implement a service layer that talks to a typed bridge client.
5. Register tools through a `ServerPlugin`.
6. Add a per-server Dockerfile and compose entry.

## Security model

- The host bridge binds to `127.0.0.1` by default.
- The published local compose path requires a bearer token on `/mcp`.
- Server-to-bridge traffic is authenticated with a dedicated bridge token.
- The published local compose path binds `8080` to `127.0.0.1` only.
- Containers must connect only to explicitly configured bridge addresses; the default compose path is local-only by default.

## Verification model

Automated checks are expected to cover:

- auth middleware
- bridge request validation
- server-side search/draft request mapping
- bridge unavailable/permission denied cases

Manual smoke tests are still required for real Apple Mail automation because local app permissions and host state cannot be fully simulated in CI.
