import type { infer as ZodInfer, ZodObject, ZodRawShape } from "zod";
import type { ServerRuntimeConfig } from "./config.js";
import type { BridgeErrorCode } from "./errors.js";
import type { Logger } from "./logger.js";

export interface BridgeOperationDefinition<TRequest, TResponse> {
  request: TRequest;
  response: TResponse;
}

export type BridgeOperationRequest<
  TBridgeOperations,
  TKey extends keyof TBridgeOperations,
> = TBridgeOperations[TKey] extends BridgeOperationDefinition<infer TRequest, unknown>
  ? TRequest
  : never;

export type BridgeOperationResponse<
  TBridgeOperations,
  TKey extends keyof TBridgeOperations,
> = TBridgeOperations[TKey] extends BridgeOperationDefinition<unknown, infer TResponse>
  ? TResponse
  : never;

export interface BridgeClient<TBridgeOperations extends object> {
  call<TKey extends keyof TBridgeOperations & string>(
    operation: TKey,
    payload: BridgeOperationRequest<TBridgeOperations, TKey>,
  ): Promise<BridgeOperationResponse<TBridgeOperations, TKey>>;
}

export interface AuthContext {
  principal: string;
  isAuthenticated: boolean;
}

export interface ToolContext<TBridgeOperations extends object> {
  auth: AuthContext;
  bridgeClient: BridgeClient<TBridgeOperations>;
  config: ServerRuntimeConfig;
  logger: Logger;
  requestId: string;
}

export interface ToolDefinition<TShape extends ZodRawShape> {
  description: string;
  inputSchema: TShape;
  name: string;
  title?: string;
}

export interface ToolRegistry<TBridgeOperations extends object> {
  registerTool<TShape extends ZodRawShape, TOutput>(
    definition: ToolDefinition<TShape>,
    handler: (
      input: ZodInfer<ZodObject<TShape>>,
      context: ToolContext<TBridgeOperations>,
    ) => Promise<TOutput>,
  ): void;
}

export interface HealthCheckResult {
  details?: unknown;
  ok: boolean;
}

export interface ServerPlugin<TBridgeOperations extends object> {
  healthCheck?(deps: {
    bridgeClient: BridgeClient<TBridgeOperations>;
    logger: Logger;
  }): Promise<HealthCheckResult> | HealthCheckResult;
  id: string;
  registerTools(registry: ToolRegistry<TBridgeOperations>): Promise<void> | void;
  version: string;
}

export interface BridgeErrorPayload {
  code: BridgeErrorCode;
  details?: unknown;
  message: string;
}
