import {
  mailDraftCreateRequestSchema,
  mailDraftUpdateRequestSchema,
  mailMailboxesListRequestSchema,
  mailMessagesSearchRequestSchema,
} from "@codex-mcp/bridge-contracts";
import type { AppleMailBridgeOperations } from "@codex-mcp/bridge-contracts";
import type { ServerPlugin, ToolRegistry } from "@codex-mcp/core";
import { AppleMailService } from "./service.js";

function serviceFor(registryContext: {
  bridgeClient: import("@codex-mcp/core").BridgeClient<AppleMailBridgeOperations>;
}) {
  return new AppleMailService(registryContext.bridgeClient);
}

export const appleMailPlugin: ServerPlugin<AppleMailBridgeOperations> = {
  id: "apple-mail",
  version: "0.1.0",
  async registerTools(registry: ToolRegistry<AppleMailBridgeOperations>) {
    registry.registerTool(
      {
        name: "mail.accounts.list",
        title: "List Mail Accounts",
        description: "List Apple Mail accounts available on the local host.",
        inputSchema: {},
      },
      async (_input, context) => serviceFor(context).listAccounts(),
    );

    registry.registerTool(
      {
        name: "mail.mailboxes.list",
        title: "List Mailboxes",
        description: "List Apple Mail mailboxes, optionally filtered by account.",
        inputSchema: mailMailboxesListRequestSchema.shape,
      },
      async (input, context) => serviceFor(context).listMailboxes(input.account),
    );

    registry.registerTool(
      {
        name: "mail.messages.search",
        title: "Search Messages",
        description: "Search Apple Mail messages by account, mailbox, sender, subject, and dates.",
        inputSchema: mailMessagesSearchRequestSchema.shape,
      },
      async (input, context) => serviceFor(context).searchMessages(input),
    );

    registry.registerTool(
      {
        name: "mail.messages.get",
        title: "Get Message",
        description: "Retrieve a full Apple Mail message by Apple Mail id.",
        inputSchema: {
          appleMailId: mailDraftUpdateRequestSchema.shape.appleMailId,
        },
      },
      async (input, context) => serviceFor(context).getMessage(input.appleMailId),
    );

    registry.registerTool(
      {
        name: "mail.drafts.create",
        title: "Create Draft",
        description: "Create a new Apple Mail draft.",
        inputSchema: mailDraftCreateRequestSchema.shape,
      },
      async (input, context) => serviceFor(context).createDraft(input),
    );

    registry.registerTool(
      {
        name: "mail.drafts.update",
        title: "Update Draft",
        description: "Update an existing Apple Mail draft by Apple Mail id.",
        inputSchema: mailDraftUpdateRequestSchema.shape,
      },
      async (input, context) => serviceFor(context).updateDraft(input),
    );
  },
  async healthCheck({ bridgeClient }) {
    await bridgeClient.call("listAccounts", {});
    return {
      ok: true,
    };
  },
};
