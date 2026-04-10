import { describe, expect, it } from "vitest";
import { BridgeError } from "@codex-mcp/core";
import { dispatchBridgeOperation, statusForBridgeError } from "../src/app.js";
import type { AppleMailGateway } from "../src/apple-mail/gateway.js";

describe("dispatchBridgeOperation", () => {
  const gateway: AppleMailGateway = {
    async listAccounts() {
      return [
        {
          id: "acc-1",
          name: "Personal",
          emailAddresses: ["me@example.com"],
        },
      ];
    },
    async listMailboxes() {
      return [];
    },
    async searchMessages() {
      return [];
    },
    async getMessage() {
      throw new Error("not implemented");
    },
    async createDraft() {
      throw new Error("not implemented");
    },
    async updateDraft() {
      throw new Error("not implemented");
    },
  };

  it("returns typed data for valid requests", async () => {
    const result = await dispatchBridgeOperation(gateway, "listAccounts", {});
    expect(result).toHaveLength(1);
    expect((result as Array<{ name: string }>)[0].name).toBe("Personal");
  });

  it("maps validation failures to HTTP 400", () => {
    const error = new BridgeError("ValidationFailed", "bad payload");
    expect(statusForBridgeError(error)).toBe(400);
  });
});
