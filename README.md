# local-tool-mcp

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
- The Apple Mail integration is a two-process system:
  - the macOS host bridge runs on a Mac that has Apple Mail installed and configured
  - the Apple Mail MCP server runs either in Docker or as a local Node process and calls the bridge over HTTP
- Containers connect to the host bridge over an explicitly configured HTTP endpoint with a shared auth token.
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

That only starts the MCP server container. You still need to run the macOS host bridge separately on the machine that has Apple Mail:

```bash
# from the repository root
pnpm -r build
BRIDGE_AUTH_TOKEN=dev-bridge-token LOG_LEVEL=debug \
pnpm --filter @codex-mcp/host-bridge-macos exec node dist/index.js
```

## Deployment topologies

### Same machine

This is the simplest setup:

1. Run the macOS host bridge on your Mac.
2. Run the Apple Mail MCP server locally or in Docker on that same Mac.
3. Point any MCP-compatible client at the MCP server URL.

Default local addresses:

- host bridge: `http://127.0.0.1:8787`
- MCP server: `http://127.0.0.1:8080/mcp`

### Separate machines

This also works, but the host bridge must still run on the Mac that owns Apple Mail.

Example:

1. Mac mini or laptop runs Apple Mail and `host-bridge-macos`
2. another machine runs the MCP server
3. the MCP server uses the Mac host bridge URL as `BRIDGE_ENDPOINT`

In that topology:

- expose the host bridge on a private network interface instead of `127.0.0.1`
- set `BRIDGE_ENDPOINT` to that reachable private URL
- keep `BRIDGE_AUTH_TOKEN` enabled
- use firewall or LAN/VPN scoping; do not expose the host bridge publicly

The important boundary is: Apple Mail automation only happens on the Mac running the bridge. The container or remote MCP server never talks to Apple Mail directly.

## Run order

For the Apple Mail server to work, start components in this order:

1. start the macOS host bridge
2. start the Apple Mail MCP server
3. connect an MCP client to the MCP server

If the MCP server starts without the bridge, `/version` will still work, but Mail-backed operations and `/healthz` will fail until the bridge is reachable.

## First server: Apple Mail

Current tool namespace:

- `mail.accounts.list`
- `mail.mailboxes.list`
- `mail.messages.search`
- `mail.messages.get`
- `mail.drafts.create`
- `mail.drafts.update`

Draft create/update currently support:

- explicit sender/account selection via `account` and `from`
- absolute host file paths for attachments

The server intentionally excludes send/delete/move/flag operations in v1.
