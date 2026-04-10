import { createLogger, startHttpServer } from "@codex-mcp/core";
import { createBridgeApp } from "./app.js";
import { loadMacosBridgeConfig } from "./config.js";
import { OsaAppleMailGateway } from "./apple-mail/jxa.js";

async function main() {
  const config = loadMacosBridgeConfig(process.env);
  const logger = createLogger(config.logLevel, {
    service: "host-bridge-macos",
  });
  const app = createBridgeApp({
    appleMailGateway: new OsaAppleMailGateway(),
    authToken: config.authToken,
    logger,
  });

  await startHttpServer(app, config.port, config.host, logger);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
