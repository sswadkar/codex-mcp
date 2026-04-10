export type BridgeErrorCode =
  | "Unavailable"
  | "PermissionDenied"
  | "NotFound"
  | "ValidationFailed"
  | "ExecutionFailed";

export class BridgeError extends Error {
  readonly code: BridgeErrorCode;
  readonly details?: unknown;

  constructor(code: BridgeErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.details = details;
  }
}

export function isBridgeError(error: unknown): error is BridgeError {
  return error instanceof BridgeError;
}

export function toBridgeError(error: unknown): BridgeError {
  if (isBridgeError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new BridgeError("ExecutionFailed", error.message);
  }

  return new BridgeError("ExecutionFailed", "Unknown bridge failure", error);
}
