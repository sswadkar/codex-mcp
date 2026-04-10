import { describe, expect, it, vi } from "vitest";
import { createServerAuthMiddleware } from "../src/http/auth.js";

describe("createServerAuthMiddleware", () => {
  it("rejects missing tokens", async () => {
    const middleware = createServerAuthMiddleware("server-token");
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const next = vi.fn();

    middleware(
      {
        header: vi.fn(() => undefined),
      } as never,
      {
        status,
      } as never,
      next,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "Unauthorized",
        message: "Missing bearer token",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts valid bearer tokens", async () => {
    const middleware = createServerAuthMiddleware("server-token");
    const req = {
      header: vi.fn(() => "Bearer server-token"),
    };
    const next = vi.fn();

    middleware(
      req as never,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect((req as { authContext?: { isAuthenticated: boolean } }).authContext?.isAuthenticated).toBe(true);
  });
});
