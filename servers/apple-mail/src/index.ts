import type { AppleMailBridgeOperations } from "@codex-mcp/bridge-contracts";
import {
  createHttpBridgeClient,
  createHttpMcpApp,
  createLogger,
  loadServerRuntimeConfig,
  startHttpServer,
} from "@codex-mcp/core";
import { appleMailPlugin } from "./plugin.js";

async function main() {
  const config = loadServerRuntimeConfig(process.env, {
    serverId: "apple-mail",
    serverName: "Apple Mail MCP Server",
    serverVersion: "0.1.0",
  });
  const logger = createLogger(config.logLevel, {
    service: config.serverId,
  });
  const bridgeClient = createHttpBridgeClient<AppleMailBridgeOperations>({
    endpoint: config.bridgeEndpoint,
    authToken: config.bridgeAuthToken,
    timeoutMs: config.requestTimeoutMs,
  });

  const app = createHttpMcpApp({
    bridgeClient,
    config,
    logger,
    plugin: appleMailPlugin,
  });

  await startHttpServer(app, config.port, config.host, logger);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
