import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { BridgeError, toBridgeError } from "../errors.js";
import type { ServerRuntimeConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type {
  BridgeClient,
  ServerPlugin,
  ToolDefinition,
  ToolContext,
  ToolRegistry,
} from "../types.js";
import type { infer as ZodInfer, ZodObject, ZodRawShape } from "zod";

type TransportMap = Map<string, StreamableHTTPServerTransport>;

class McpToolRegistry<TBridgeOperations extends object>
  implements ToolRegistry<TBridgeOperations>
{
  constructor(
    private readonly server: McpServer,
    private readonly contextFactory: () => ToolContext<TBridgeOperations>,
  ) {}

  registerTool<TShape extends ZodRawShape, TOutput>(
    definition: ToolDefinition<TShape>,
    handler: (
      input: ZodInfer<ZodObject<TShape>>,
      context: ToolContext<TBridgeOperations>,
    ) => Promise<TOutput>,
  ): void {
    const options = {
      description: definition.description,
      inputSchema: definition.inputSchema,
      ...(definition.title ? { title: definition.title } : {}),
    };
    const toolHandler = (async (input: ZodInfer<ZodObject<TShape>>) => {
      const result = await handler(input, this.contextFactory());
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }) as unknown as Parameters<McpServer["registerTool"]>[2];

    this.server.registerTool(
      definition.name,
      options,
      toolHandler,
    );
  }
}

interface CreateHttpMcpAppOptions<TBridgeOperations extends object> {
  bridgeClient: BridgeClient<TBridgeOperations>;
  config: ServerRuntimeConfig;
  logger: Logger;
  plugin: ServerPlugin<TBridgeOperations>;
}

export function createHttpMcpApp<TBridgeOperations extends object>(
  options: CreateHttpMcpAppOptions<TBridgeOperations>,
): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const transports: TransportMap = new Map();

  app.get("/healthz", async (_req, res) => {
    try {
      const result = options.plugin.healthCheck
        ? await options.plugin.healthCheck({
            bridgeClient: options.bridgeClient,
            logger: options.logger.child({ area: "healthcheck" }),
          })
        : { ok: true };

      res.status(result.ok ? 200 : 503).json(result);
    } catch (error) {
      const bridgeError = toBridgeError(error);
      res.status(503).json({
        ok: false,
        error: {
          code: bridgeError.code,
          message: bridgeError.message,
        },
      });
    }
  });

  app.get("/version", (_req, res) => {
    res.json({
      id: options.config.serverId,
      name: options.config.serverName,
      version: options.config.serverVersion,
    });
  });

  app.all("/mcp", async (req, res) => {
    try {
      await handleMcpRequest(req, res, options, transports);
    } catch (error) {
      const bridgeError = toBridgeError(error);
      options.logger.error("Unhandled MCP request failure", {
        code: bridgeError.code,
        message: bridgeError.message,
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: bridgeError.message,
            data: {
              category: bridgeError.code,
            },
          },
          id: null,
        });
      }
    }
  });

  return app;
}

async function handleMcpRequest<TBridgeOperations extends object>(
  req: Request,
  res: Response,
  options: CreateHttpMcpAppOptions<TBridgeOperations>,
  transports: TransportMap,
): Promise<void> {
  if (!authorizeMcpRequest(req, res, options.config.authToken)) {
    return;
  }

  const sessionId = req.header("mcp-session-id");
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    if (sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    if (req.method !== "POST" || !isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: Missing initialize request",
        },
        id: null,
      });
      return;
    }

    const server = await createPluginServer(options);
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId: string) => {
        transports.set(newSessionId, transport!);
      },
    });

    transport.onclose = () => {
      if (transport?.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    await server.connect(
      transport as Parameters<typeof server.connect>[0],
    );
  }

  await transport.handleRequest(req, res, req.body);
}

function authorizeMcpRequest(req: Request, res: Response, expectedToken?: string): boolean {
  if (!expectedToken) {
    req.authContext = {
      principal: "anonymous",
      isAuthenticated: false,
    };
    return true;
  }

  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "Unauthorized",
        message: "Missing bearer token",
      },
    });
    return false;
  }

  const token = header.slice("Bearer ".length);
  if (token !== expectedToken) {
    res.status(403).json({
      error: {
        code: "Unauthorized",
        message: "Invalid bearer token",
      },
    });
    return false;
  }

  req.authContext = {
    principal: "local-user",
    isAuthenticated: true,
  };
  return true;
}

async function createPluginServer<TBridgeOperations extends object>(
  options: CreateHttpMcpAppOptions<TBridgeOperations>,
): Promise<McpServer> {
  const server = new McpServer({
    name: options.plugin.id,
    version: options.plugin.version,
  });

  const registry = new McpToolRegistry(server, () => {
    const requestId = randomUUID();
    return {
      auth: {
        principal: options.config.authToken ? "local-user" : "anonymous",
        isAuthenticated: Boolean(options.config.authToken),
      },
      bridgeClient: options.bridgeClient,
      config: options.config,
      logger: options.logger.child({ requestId }),
      requestId,
    };
  });

  await options.plugin.registerTools(registry);
  return server;
}

export function toBridgeJsonRpcError(error: unknown): {
  code: number;
  data: { category: string };
  message: string;
} {
  const bridgeError = error instanceof BridgeError ? error : toBridgeError(error);
  return {
    code: -32000,
    message: bridgeError.message,
    data: {
      category: bridgeError.code,
    },
  };
}
