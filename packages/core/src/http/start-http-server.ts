import type { Server } from "node:http";
import { createServer } from "node:http";
import type { Express } from "express";
import type { Logger } from "../logger.js";

export async function startHttpServer(app: Express, port: number, host: string, logger: Logger) {
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  logger.info("HTTP server listening", {
    host,
    port,
  });

  return server;
}

export async function stopHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
