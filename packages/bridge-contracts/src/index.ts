import { z } from "zod";

export const mailAddressSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().email(),
});

export const mailAttachmentSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1).nullable(),
});

export const mailMessageSummarySchema = z.object({
  appleMailId: z.string().min(1),
  messageId: z.string().min(1).nullable(),
  mailbox: z.string().min(1),
  account: z.string().min(1),
  subject: z.string().nullable(),
  from: mailAddressSchema.nullable(),
  to: z.array(mailAddressSchema),
  cc: z.array(mailAddressSchema),
  dateReceived: z.string().datetime().nullable(),
  isRead: z.boolean(),
  snippet: z.string().nullable(),
});

export const mailMessageSchema = mailMessageSummarySchema.extend({
  bcc: z.array(mailAddressSchema),
  bodyText: z.string().nullable(),
});

export const mailAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  emailAddresses: z.array(z.string().email()),
});
export const mailAccountsListResponseSchema = z.array(mailAccountSchema);

export const mailMailboxSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  account: z.string().min(1),
  fullPath: z.string().min(1),
});
export const mailMailboxesListResponseSchema = z.array(mailMailboxSchema);

export const mailMailboxesListRequestSchema = z.object({
  account: z.string().min(1).optional(),
});

export const mailMessagesSearchRequestSchema = z.object({
  account: z.string().min(1).optional(),
  mailbox: z.string().min(1).optional(),
  unread: z.boolean().optional(),
  from: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  receivedAfter: z.string().datetime().optional(),
  receivedBefore: z.string().datetime().optional(),
  limit: z.number().int().positive().max(100).default(25),
});
export const mailMessagesSearchResponseSchema = z.array(mailMessageSummarySchema);

export const mailMessageGetRequestSchema = z.object({
  appleMailId: z.string().min(1),
});
export const mailMessageGetResponseSchema = mailMessageSchema;

export const mailDraftCreateRequestSchema = z.object({
  account: z.string().min(1).optional(),
  from: z.string().email().optional(),
  to: z.array(mailAddressSchema).default([]),
  cc: z.array(mailAddressSchema).default([]),
  bcc: z.array(mailAddressSchema).default([]),
  attachments: z
    .array(
      z.string().min(1).refine((value) => value.startsWith("/"), {
        message: "Attachment paths must be absolute",
      }),
    )
    .default([]),
  subject: z.string().max(998).default(""),
  bodyText: z.string().default(""),
});

export const mailDraftUpdateRequestSchema = z.object({
  appleMailId: z.string().min(1),
  account: z.string().min(1).optional(),
  from: z.string().email().optional(),
  to: z.array(mailAddressSchema).optional(),
  cc: z.array(mailAddressSchema).optional(),
  bcc: z.array(mailAddressSchema).optional(),
  attachments: z
    .array(
      z.string().min(1).refine((value) => value.startsWith("/"), {
        message: "Attachment paths must be absolute",
      }),
    )
    .optional(),
  subject: z.string().max(998).optional(),
  bodyText: z.string().optional(),
});

export const mailDraftResponseSchema = z.object({
  appleMailId: z.string().min(1),
  messageId: z.string().min(1).nullable(),
  mailbox: z.string().min(1),
  account: z.string().min(1),
  from: mailAddressSchema.nullable(),
  subject: z.string().nullable(),
  to: z.array(mailAddressSchema),
  cc: z.array(mailAddressSchema),
  bcc: z.array(mailAddressSchema),
  attachments: z.array(mailAttachmentSchema),
  bodyText: z.string().nullable(),
});
export const mailDraftCreateResponseSchema = mailDraftResponseSchema;
export const mailDraftUpdateResponseSchema = mailDraftResponseSchema;

export const bridgeInvokeRequestSchema = z.object({
  operation: z.enum([
    "listAccounts",
    "listMailboxes",
    "searchMessages",
    "getMessage",
    "createDraft",
    "updateDraft",
  ]),
  payload: z.unknown(),
});

export const bridgeInvokeResponseSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.enum([
        "Unavailable",
        "PermissionDenied",
        "NotFound",
        "ValidationFailed",
        "ExecutionFailed",
      ]),
      message: z.string().min(1),
      details: z.unknown().optional(),
    })
    .optional(),
});

export type MailAddress = z.infer<typeof mailAddressSchema>;
export type MailAttachment = z.infer<typeof mailAttachmentSchema>;
export type MailAccount = z.infer<typeof mailAccountSchema>;
export type MailMailbox = z.infer<typeof mailMailboxSchema>;
export type MailMessageSummary = z.infer<typeof mailMessageSummarySchema>;
export type MailMessage = z.infer<typeof mailMessageSchema>;
export type MailMessagesSearchRequest = z.infer<typeof mailMessagesSearchRequestSchema>;
export type MailMessageGetRequest = z.infer<typeof mailMessageGetRequestSchema>;
export type MailDraftCreateRequest = z.infer<typeof mailDraftCreateRequestSchema>;
export type MailDraftUpdateRequest = z.infer<typeof mailDraftUpdateRequestSchema>;
export type MailDraftResponse = z.infer<typeof mailDraftResponseSchema>;
export type BridgeInvokeRequest = z.infer<typeof bridgeInvokeRequestSchema>;
export type BridgeInvokeResponse = z.infer<typeof bridgeInvokeResponseSchema>;

export interface AppleMailBridgeOperations {
  listAccounts: {
    request: Record<string, never>;
    response: MailAccount[];
  };
  listMailboxes: {
    request: z.infer<typeof mailMailboxesListRequestSchema>;
    response: MailMailbox[];
  };
  searchMessages: {
    request: MailMessagesSearchRequest;
    response: MailMessageSummary[];
  };
  getMessage: {
    request: MailMessageGetRequest;
    response: MailMessage;
  };
  createDraft: {
    request: MailDraftCreateRequest;
    response: MailDraftResponse;
  };
  updateDraft: {
    request: MailDraftUpdateRequest;
    response: MailDraftResponse;
  };
}

export type AppleMailBridgeOperationName = keyof AppleMailBridgeOperations;
