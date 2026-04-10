import { bridgeInvokeResponseSchema } from "@codex-mcp/bridge-contracts";
import { BridgeError } from "../errors.js";
import type {
  BridgeClient,
  BridgeOperationRequest,
  BridgeOperationResponse,
} from "../types.js";

interface BridgeClientOptions {
  authToken: string;
  endpoint: string;
  timeoutMs: number;
}

export function createHttpBridgeClient<TBridgeOperations extends object>(
  options: BridgeClientOptions,
): BridgeClient<TBridgeOperations> {
  return {
    async call<TKey extends keyof TBridgeOperations & string>(
      operation: TKey,
      payload: BridgeOperationRequest<TBridgeOperations, TKey>,
    ): Promise<BridgeOperationResponse<TBridgeOperations, TKey>> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

      try {
        const response = await fetch(`${options.endpoint}/invoke`, {
          method: "POST",
          headers: {
            "authorization": `Bearer ${options.authToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            operation,
            payload,
          }),
          signal: controller.signal,
        });

        const json = await response.json().catch(() => undefined);
        if (json === undefined) {
          throw new BridgeError(
            "Unavailable",
            `Bridge request failed with status ${response.status} and no JSON body`,
          );
        }

        const parsed = bridgeInvokeResponseSchema.parse(json);

        if (!parsed.ok || parsed.error) {
          throw new BridgeError(
            parsed.error?.code ?? "ExecutionFailed",
            parsed.error?.message ?? "Bridge execution failed",
            parsed.error?.details,
          );
        }

        if (!response.ok) {
          throw new BridgeError(
            "Unavailable",
            `Bridge request failed with status ${response.status}`,
          );
        }

        return parsed.data as BridgeOperationResponse<TBridgeOperations, TKey>;
      } catch (error) {
        if (error instanceof BridgeError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw new BridgeError("Unavailable", "Bridge request timed out");
        }

        throw new BridgeError("Unavailable", "Bridge request failed", error);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
