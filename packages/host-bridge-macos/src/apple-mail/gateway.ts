import type {
  AppleMailBridgeOperations,
  MailAccount,
  MailDraftCreateRequest,
  MailDraftResponse,
  MailDraftUpdateRequest,
  MailMailbox,
  MailMessage,
  MailMessagesSearchRequest,
  MailMessageSummary,
} from "@codex-mcp/bridge-contracts";

export interface AppleMailGateway {
  createDraft(input: MailDraftCreateRequest): Promise<MailDraftResponse>;
  getMessage(input: AppleMailBridgeOperations["getMessage"]["request"]): Promise<MailMessage>;
  listAccounts(): Promise<MailAccount[]>;
  listMailboxes(input: AppleMailBridgeOperations["listMailboxes"]["request"]): Promise<MailMailbox[]>;
  searchMessages(input: MailMessagesSearchRequest): Promise<MailMessageSummary[]>;
  updateDraft(input: MailDraftUpdateRequest): Promise<MailDraftResponse>;
}
