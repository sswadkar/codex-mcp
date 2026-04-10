import { describe, expect, it, vi } from "vitest";
import type { AppleMailBridgeOperations } from "@codex-mcp/bridge-contracts";
import type { BridgeClient } from "@codex-mcp/core";
import { AppleMailService } from "../src/service.js";

describe("AppleMailService", () => {
  it("maps search filters to bridge calls", async () => {
    const call = vi.fn(async () => []);
    const service = new AppleMailService({
      call,
    } as unknown as BridgeClient<AppleMailBridgeOperations>);

    await service.searchMessages({
      account: "Personal",
      mailbox: "Inbox",
      unread: true,
      from: "boss@example.com",
      subject: "Quarterly",
      receivedAfter: "2026-01-01T00:00:00.000Z",
      limit: 10,
    });

    expect(call).toHaveBeenCalledWith("searchMessages", {
      account: "Personal",
      mailbox: "Inbox",
      unread: true,
      from: "boss@example.com",
      subject: "Quarterly",
      receivedAfter: "2026-01-01T00:00:00.000Z",
      limit: 10,
    });
  });

  it("passes draft updates through using appleMailId", async () => {
    const call = vi.fn(async () => ({
      appleMailId: "draft-1",
      messageId: null,
      mailbox: "Drafts",
      account: "Personal",
      subject: "Hello",
      to: [],
      cc: [],
      bcc: [],
      bodyText: "Test",
    }));
    const service = new AppleMailService({
      call,
    } as unknown as BridgeClient<AppleMailBridgeOperations>);

    await service.updateDraft({
      appleMailId: "draft-1",
      subject: "Hello",
      bodyText: "Test",
    });

    expect(call).toHaveBeenCalledWith("updateDraft", {
      appleMailId: "draft-1",
      subject: "Hello",
      bodyText: "Test",
    });
  });
});
