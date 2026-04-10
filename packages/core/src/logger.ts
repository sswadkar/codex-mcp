export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  child(bindings: Record<string, unknown>): Logger;
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class JsonLogger implements Logger {
  constructor(
    private readonly level: LogLevel,
    private readonly bindings: Record<string, unknown> = {},
  ) {}

  child(bindings: Record<string, unknown>): Logger {
    return new JsonLogger(this.level, {
      ...this.bindings,
      ...bindings,
    });
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }

    const payload = {
      level,
      message,
      ...this.bindings,
      ...(data === undefined ? {} : { data }),
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(payload);
    if (level === "error") {
      console.error(line);
      return;
    }

    console.log(line);
  }
}

export function createLogger(level: LogLevel, bindings?: Record<string, unknown>): Logger {
  return new JsonLogger(level, bindings);
}
