import express, { type Express } from "express";
import {
  bridgeInvokeRequestSchema,
  mailDraftCreateRequestSchema,
  mailDraftUpdateRequestSchema,
  mailMailboxesListRequestSchema,
  mailMessageGetRequestSchema,
  mailMessagesSearchRequestSchema,
} from "@codex-mcp/bridge-contracts";
import { BridgeError, createServerAuthMiddleware, toBridgeError } from "@codex-mcp/core";
import type { Logger } from "@codex-mcp/core";
import type { AppleMailGateway } from "./apple-mail/gateway.js";

interface CreateBridgeAppOptions {
  appleMailGateway: AppleMailGateway;
  authToken: string;
  logger: Logger;
}

export function createBridgeApp(options: CreateBridgeAppOptions): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      service: "host-bridge-macos",
    });
  });

  app.use(createServerAuthMiddleware(options.authToken));

  app.post("/invoke", async (req, res) => {
    try {
      const request = bridgeInvokeRequestSchema.parse(req.body);
      const result = await dispatchBridgeOperation(options.appleMailGateway, request.operation, request.payload);
      res.json({
        ok: true,
        data: result,
      });
    } catch (error) {
      const bridgeError = toBridgeError(error);
      options.logger.warn("Bridge operation failed", {
        code: bridgeError.code,
        details: bridgeError.details,
        message: bridgeError.message,
      });

      res.status(statusForBridgeError(bridgeError)).json({
        ok: false,
        error: {
          code: bridgeError.code,
          message: bridgeError.message,
          details: bridgeError.details,
        },
      });
    }
  });

  return app;
}

export async function dispatchBridgeOperation(
  gateway: AppleMailGateway,
  operation: string,
  payload: unknown,
): Promise<unknown> {
  switch (operation) {
    case "listAccounts":
      return gateway.listAccounts();
    case "listMailboxes":
      return gateway.listMailboxes(mailMailboxesListRequestSchema.parse(payload));
    case "searchMessages":
      return gateway.searchMessages(mailMessagesSearchRequestSchema.parse(payload));
    case "getMessage":
      return gateway.getMessage(mailMessageGetRequestSchema.parse(payload));
    case "createDraft":
      return gateway.createDraft(mailDraftCreateRequestSchema.parse(payload));
    case "updateDraft":
      return gateway.updateDraft(mailDraftUpdateRequestSchema.parse(payload));
    default:
      throw new BridgeError("ValidationFailed", `Unsupported operation: ${operation}`);
  }
}

export function statusForBridgeError(error: BridgeError): number {
  switch (error.code) {
    case "ValidationFailed":
      return 400;
    case "PermissionDenied":
      return 403;
    case "NotFound":
      return 404;
    case "Unavailable":
      return 503;
    default:
      return 500;
  }
}
