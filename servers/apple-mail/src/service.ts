import type {
  AppleMailBridgeOperations,
  MailDraftCreateRequest,
  MailDraftUpdateRequest,
  MailMessagesSearchRequest,
} from "@codex-mcp/bridge-contracts";
import type { BridgeClient } from "@codex-mcp/core";

export class AppleMailService {
  constructor(
    private readonly bridgeClient: BridgeClient<AppleMailBridgeOperations>,
  ) {}

  async listAccounts() {
    return this.bridgeClient.call("listAccounts", {});
  }

  async listMailboxes(account?: string) {
    return this.bridgeClient.call("listMailboxes", account ? { account } : {});
  }

  async searchMessages(input: MailMessagesSearchRequest) {
    return this.bridgeClient.call("searchMessages", input);
  }

  async getMessage(appleMailId: string) {
    return this.bridgeClient.call("getMessage", {
      appleMailId,
    });
  }

  async createDraft(input: MailDraftCreateRequest) {
    return this.bridgeClient.call("createDraft", input);
  }

  async updateDraft(input: MailDraftUpdateRequest) {
    return this.bridgeClient.call("updateDraft", input);
  }
}
