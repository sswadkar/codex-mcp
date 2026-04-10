# codex-mcp

Monorepo for local MCP servers that integrate with host tools. The first server is `apple-mail`, which exposes Apple Mail read/search/draft workflows through an HTTP MCP server backed by a macOS host bridge.

## Structure

```text
packages/
  core/                Shared MCP bootstrap, config, logging, auth, bridge client
  bridge-contracts/    Shared request/response schemas and Apple Mail types
  host-bridge-macos/   macOS-only bridge that talks to Apple Mail through osascript/JXA
servers/
  apple-mail/          Apple Mail MCP server package
infra/
  docker/              Shared Docker build assets
  compose/             Local docker-compose manifests
docs/
  architecture.md      Platform notes and extension pattern
```

## Runtime model

- MCP servers are separate packages under `servers/*`.
- Shared logic lives in `packages/core`.
- macOS-only automations stay outside Docker in `packages/host-bridge-macos`.
- Containers connect to the host bridge over loopback-style host networking with a shared auth token.
- The published Docker compose path binds the MCP server to `127.0.0.1` and requires an explicit MCP bearer token.

## Expected environment

This scaffold assumes:

- Node 22+
- `pnpm`
- `osascript` available on the macOS host for the bridge package
- Docker available if you want to run the MCP server in a container

## Local compose

`infra/compose/local.yaml` is intentionally locked down for local use:

- it binds the MCP server to `127.0.0.1:8080`
- it requires `APPLE_MAIL_SERVER_AUTH_TOKEN`
- it requires `BRIDGE_AUTH_TOKEN`

Example:

```bash
APPLE_MAIL_SERVER_AUTH_TOKEN=dev-server-token \
BRIDGE_AUTH_TOKEN=dev-bridge-token \
docker compose -f infra/compose/local.yaml up --build
```

## First server: Apple Mail

Current tool namespace:

- `mail.accounts.list`
- `mail.mailboxes.list`
- `mail.messages.search`
- `mail.messages.get`
- `mail.drafts.create`
- `mail.drafts.update`

The server intentionally excludes send/delete/move/flag operations in v1.
