import { spawn } from "node:child_process";
import type {
  MailAddress,
  MailDraftCreateRequest,
  MailDraftUpdateRequest,
  MailMessagesSearchRequest,
} from "@codex-mcp/bridge-contracts";
import {
  mailAccountsListResponseSchema,
  mailDraftCreateResponseSchema,
  mailDraftUpdateResponseSchema,
  mailMailboxesListResponseSchema,
  mailMessageGetResponseSchema,
  mailMessagesSearchResponseSchema,
} from "@codex-mcp/bridge-contracts";
import { BridgeError } from "@codex-mcp/core";
import { z } from "zod";
import type { AppleMailGateway } from "./gateway.js";

interface OsaExecutor {
  runAppleScript(script: string): Promise<string>;
  runJxa(script: string, payload?: unknown): Promise<string>;
}

export class OsaScriptExecutor implements OsaExecutor {
  async runAppleScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn("osascript", [], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (error) => {
        reject(new BridgeError("Unavailable", "Unable to launch osascript", error));
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(normalizeAppleMailError(stderr || stdout));
          return;
        }
        resolve(stdout.trim());
      });

      child.stdin.write(script);
      child.stdin.end();
    });
  }

  async runJxa(script: string, payload?: unknown): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn("osascript", ["-l", "JavaScript"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (error) => {
        reject(new BridgeError("Unavailable", "Unable to launch osascript", error));
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(normalizeAppleMailError(stderr || stdout));
          return;
        }
        resolve(stdout.trim());
      });

      const payloadLiteral = JSON.stringify(payload ?? {});
      child.stdin.write(`${script}\n`);
      child.stdin.write(`run(${payloadLiteral === "{}" ? "[]" : `[${JSON.stringify(payloadLiteral)}]`});\n`);
      child.stdin.end();
    });
  }
}

export class OsaAppleMailGateway implements AppleMailGateway {
  constructor(private readonly executor: OsaExecutor = new OsaScriptExecutor()) {}

  async listAccounts() {
    const output = await this.executor.runAppleScript(buildListAccountsAppleScript());
    return parseAccountsAppleScriptResponse(output);
  }

  async listMailboxes(input: { account?: string }) {
    const output = await this.executor.runAppleScript(buildListMailboxesAppleScript(input));
    return parseMailboxesAppleScriptResponse(output);
  }

  async searchMessages(input: MailMessagesSearchRequest) {
    return executeJsonScript(
      this.executor,
      buildSearchMessagesScript(),
      mailMessagesSearchResponseSchema,
      input,
    );
  }

  async getMessage(input: { appleMailId: string }) {
    return executeJsonScript(
      this.executor,
      buildGetMessageScript(),
      mailMessageGetResponseSchema,
      input,
    );
  }

  async createDraft(input: MailDraftCreateRequest) {
    const result = await this.executor.runAppleScript(buildCreateDraftScript(input));
    const appleMailId = parseDraftMutationId(result);
    return parseDraftReadAppleScriptResponse(
      await this.executor.runAppleScript(buildGetDraftAppleScript(appleMailId)),
      mailDraftCreateResponseSchema,
    );
  }

  async updateDraft(input: MailDraftUpdateRequest) {
    const result = await this.executor.runAppleScript(buildUpdateDraftScript(input));
    const appleMailId = parseDraftMutationId(result);
    return parseDraftReadAppleScriptResponse(
      await this.executor.runAppleScript(buildGetDraftAppleScript(appleMailId)),
      mailDraftUpdateResponseSchema,
    );
  }
}

async function executeJsonScript<T>(
  executor: OsaExecutor,
  script: string,
  schema: z.ZodType<T>,
  payload?: unknown,
): Promise<T> {
  const stdout = await executor.runJxa(script, payload);

  try {
    return schema.parse(JSON.parse(stdout));
  } catch (error) {
    throw new BridgeError("ExecutionFailed", "Apple Mail bridge returned invalid JSON", {
      error,
      stdout,
    });
  }
}

function normalizeAppleMailError(output: string): BridgeError {
  const lowered = output.toLowerCase();
  if (lowered.includes("not authorized") || lowered.includes("not permitted")) {
    return new BridgeError(
      "PermissionDenied",
      "Apple Mail automation permission is missing",
      output,
    );
  }

  if (lowered.includes("can't get")) {
    return new BridgeError("NotFound", "Apple Mail item was not found", output);
  }

  return new BridgeError("ExecutionFailed", "Apple Mail automation failed", output);
}

function parseDraftMutationId(output: string): string {
  const [appleMailId] = output.split("\n");
  const trimmed = appleMailId?.trim();
  if (!trimmed) {
    throw new BridgeError("ExecutionFailed", "Apple Mail draft mutation did not return a draft id", {
      output,
    });
  }
  return trimmed;
}

function parseDraftReadAppleScriptResponse<T>(
  output: string,
  schema: z.ZodType<T>,
): T {
  const fieldDelimiter = "\u001e";
  const listDelimiter = "\u001f";
  const [
    appleMailId,
    account,
    subject,
    bodyText,
    toText,
    ccText,
    bccText,
    messageId,
  ] = output.split(fieldDelimiter);

  const parseAddresses = (value?: string) =>
    (value ?? "")
      .split(listDelimiter)
      .map((address) => address.trim())
      .filter(Boolean)
      .map((address) => ({ address }));

  return schema.parse({
    appleMailId: appleMailId?.trim() ?? "",
    messageId: messageId?.trim() ? messageId.trim() : null,
    mailbox: "Drafts",
    account: account?.trim() || "Unknown",
    subject: subject ?? null,
    to: parseAddresses(toText),
    cc: parseAddresses(ccText),
    bcc: parseAddresses(bccText),
    bodyText: bodyText ?? null,
  });
}

function parseAccountsAppleScriptResponse(output: string) {
  const rowDelimiter = "\n";
  const fieldDelimiter = "\u001e";
  const listDelimiter = "\u001f";

  const accounts = output
    .split(rowDelimiter)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, name, emails] = line.split(fieldDelimiter);
      const emailAddresses = (emails ?? "")
        .split(listDelimiter)
        .map((value) => value.trim())
        .filter(Boolean);

      return {
        id: id?.trim() || name?.trim() || "unknown-account",
        name: name?.trim() || id?.trim() || "Unknown",
        emailAddresses,
      };
    });

  return mailAccountsListResponseSchema.parse(accounts);
}

function parseMailboxesAppleScriptResponse(output: string) {
  const rowDelimiter = "\n";
  const fieldDelimiter = "\u001e";

  const mailboxes = output
    .split(rowDelimiter)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, name, account, fullPath] = line.split(fieldDelimiter);
      return {
        id: id?.trim() || `${account?.trim() || "Unknown"}:${name?.trim() || "Unknown"}`,
        name: name?.trim() || "Unknown",
        account: account?.trim() || "Unknown",
        fullPath: fullPath?.trim() || `${account?.trim() || "Unknown"}/${name?.trim() || "Unknown"}`,
      };
    });

  return mailMailboxesListResponseSchema.parse(mailboxes);
}

function toAppleScriptStringLiteral(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  return lines
    .map((line) => `"${line.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(" & linefeed & ");
}

function recipientAddressListLiteral(addresses: MailAddress[]): string {
  if (addresses.length === 0) {
    return "{}";
  }

  const entries = addresses.map((address) => toAppleScriptStringLiteral(address.address));

  return `{${entries.join(", ")}}`;
}

function buildSharedPrelude(): string {
  return `
function run(argv) {
  const input = argv.length > 0 ? JSON.parse(argv[0]) : {};
  const Mail = Application("Mail");
  Mail.includeStandardAdditions = false;

  function readValue(target, keys, fallback = null) {
    for (const key of keys) {
      try {
        const candidate = target[key];
        const value = typeof candidate === "function" ? candidate.call(target) : candidate;
        if (value !== undefined) {
          return value;
        }
      } catch (error) {}
    }
    return fallback;
  }

  function toAddress(value) {
    if (!value) {
      return null;
    }

    if (typeof value === "string") {
      const match = value.match(/^(.*)<([^>]+)>$/);
      if (!match) {
        return { name: null, address: value.trim() };
      }
      return {
        name: match[1].trim() || null,
        address: match[2].trim()
      };
    }

    return {
      name: readValue(value, ["name"], null),
      address: readValue(value, ["address"], null)
    };
  }

  function toAddresses(items) {
    return (items || [])
      .map(toAddress)
      .filter((item) => item && item.address);
  }

  function accountNameForMailbox(mailbox) {
    const account = readValue(mailbox, ["account"], null);
    return account ? readValue(account, ["name"], "Unknown") : "Unknown";
  }

  function mailboxPath(mailbox) {
    return readValue(mailbox, ["name"], "Unknown");
  }

  function summarizeMessage(message, mailbox, accountName) {
    const sender = toAddress(readValue(message, ["sender"], null));
    return {
      appleMailId: String(readValue(message, ["id"], "")),
      messageId: readValue(message, ["messageId"], null),
      mailbox: mailbox ? mailboxPath(mailbox) : "Unknown",
      account: accountName || "Unknown",
      subject: readValue(message, ["subject"], null),
      from: sender,
      to: toAddresses(readValue(message, ["toRecipients"], [])),
      cc: toAddresses(readValue(message, ["ccRecipients"], [])),
      dateReceived: (() => {
        const value = readValue(message, ["dateReceived", "dateSent"], null);
        return value instanceof Date ? value.toISOString() : null;
      })(),
      isRead: Boolean(readValue(message, ["readStatus", "wasRead"], false)),
      snippet: readValue(message, ["content"], null),
    };
  }

  function fullMessage(message, mailbox, accountName) {
    const summary = summarizeMessage(message, mailbox, accountName);
    return Object.assign(summary, {
      bcc: toAddresses(readValue(message, ["bccRecipients"], [])),
      bodyText: readValue(message, ["content"], null),
    });
  }

  function resolveAccounts() {
    return Mail.accounts();
  }

  function resolveMailboxes(accounts, filterAccountName) {
    const allMailboxes = [];
    accounts.forEach((account) => {
      const accountName = readValue(account, ["name"], "Unknown");
      if (filterAccountName && accountName !== filterAccountName) {
        return;
      }

      readValue(account, ["mailboxes"], []).forEach((mailbox) => {
        allMailboxes.push({ accountName, mailbox });
      });
    });
    return allMailboxes;
  }
`;
}

function buildListAccountsScript(): string {
  return `${buildSharedPrelude()}
  return JSON.stringify(resolveAccounts().map((account) => ({
    id: String(readValue(account, ["id"], readValue(account, ["name"], "unknown-account"))),
    name: readValue(account, ["name"], "Unknown"),
    emailAddresses: readValue(account, ["emailAddresses"], []).map((address) => String(address)),
  })));
}`;
}

function buildListMailboxesScript(): string {
  return `${buildSharedPrelude()}
  return JSON.stringify(
    resolveMailboxes(resolveAccounts(), input.account).map(({ accountName, mailbox }) => ({
      id: String(readValue(mailbox, ["id"], \`\${accountName}:\${mailboxPath(mailbox)}\`)),
      name: mailboxPath(mailbox),
      account: accountName,
      fullPath: \`\${accountName}/\${mailboxPath(mailbox)}\`,
    })),
  );
}`;
}

function buildListAccountsAppleScript(): string {
  return `
tell application "Mail"
  set fieldDelimiter to character id 30
  set listDelimiter to character id 31
  set outputLines to {}
  repeat with accountRef in accounts
    set accountId to ""
    set accountName to ""
    set accountEmails to {}

    try
      set accountId to (id of accountRef as text)
    end try
    try
      set accountName to (name of accountRef as text)
    end try
    try
      set accountEmails to email addresses of accountRef
    end try

    set AppleScript's text item delimiters to listDelimiter
    set emailText to accountEmails as text
    set AppleScript's text item delimiters to fieldDelimiter
    set end of outputLines to accountId & fieldDelimiter & accountName & fieldDelimiter & emailText
  end repeat

  set AppleScript's text item delimiters to linefeed
  set outputText to outputLines as text
  set AppleScript's text item delimiters to ""
  return outputText
end tell
`;
}

function buildListMailboxesAppleScript(input: { account?: string }): string {
  const accountFilter = input.account
    ? `set requestedAccountName to ${toAppleScriptStringLiteral(input.account)}`
    : 'set requestedAccountName to ""';

  return `
${accountFilter}
tell application "Mail"
  set fieldDelimiter to character id 30
  set outputLines to {}

  repeat with accountRef in accounts
    set accountName to ""
    try
      set accountName to (name of accountRef as text)
    end try

    if requestedAccountName is "" or accountName is requestedAccountName then
      repeat with mailboxRef in mailboxes of accountRef
        set mailboxId to ""
        set mailboxName to ""
        try
          set mailboxId to (id of mailboxRef as text)
        end try
        try
          set mailboxName to (name of mailboxRef as text)
        end try

        set mailboxPath to accountName & "/" & mailboxName
        set AppleScript's text item delimiters to fieldDelimiter
        set end of outputLines to mailboxId & fieldDelimiter & mailboxName & fieldDelimiter & accountName & fieldDelimiter & mailboxPath
      end repeat
    end if
  end repeat

  set AppleScript's text item delimiters to linefeed
  set outputText to outputLines as text
  set AppleScript's text item delimiters to ""
  return outputText
end tell
`;
}

function buildSearchMessagesScript(): string {
  return `${buildSharedPrelude()}
  const limit = input.limit || 25;
  const results = [];

  resolveMailboxes(resolveAccounts(), input.account).forEach(({ accountName, mailbox }) => {
    if (input.mailbox && mailboxPath(mailbox) !== input.mailbox) {
      return;
    }

    const messages = readValue(mailbox, ["messages"], []);
    for (const message of messages) {
      const summary = summarizeMessage(message, mailbox, accountName);
      if (input.unread !== undefined && summary.isRead === input.unread) {
        continue;
      }
      if (input.from && (!summary.from || !summary.from.address.toLowerCase().includes(String(input.from).toLowerCase()))) {
        continue;
      }
      if (input.subject && !(summary.subject || "").toLowerCase().includes(String(input.subject).toLowerCase())) {
        continue;
      }
      if (input.receivedAfter && summary.dateReceived && new Date(summary.dateReceived) < new Date(input.receivedAfter)) {
        continue;
      }
      if (input.receivedBefore && summary.dateReceived && new Date(summary.dateReceived) > new Date(input.receivedBefore)) {
        continue;
      }
      results.push(summary);
      if (results.length >= limit) {
        return JSON.stringify(results);
      }
    }
  });

  return JSON.stringify(results.slice(0, limit));
}`;
}

function buildGetMessageScript(): string {
  return `${buildSharedPrelude()}
  const messageId = String(input.appleMailId);
  const mailboxes = resolveMailboxes(resolveAccounts());
  for (const entry of mailboxes) {
    const message = readValue(entry.mailbox, ["messages"], []).find((candidate) => String(readValue(candidate, ["id"], "")) === messageId);
    if (message) {
      return JSON.stringify(fullMessage(message, entry.mailbox, entry.accountName));
    }
  }
  throw new Error("Can't get message " + messageId);
}`;
}

function buildGetDraftAppleScript(appleMailId: string): string {
  const numericDraftId = Number(appleMailId);
  if (!Number.isFinite(numericDraftId)) {
    throw new BridgeError("ValidationFailed", "Draft appleMailId must be numeric");
  }

  return `
tell application "Mail"
  set fieldDelimiter to character id 30
  set listDelimiter to character id 31
  set matchingDrafts to (every outgoing message whose id is ${numericDraftId})
  if (count of matchingDrafts) is 0 then error "Can't get draft ${appleMailId.replace(/"/g, '\\"')}"
  set targetDraft to item 1 of matchingDrafts

  set accountName to "Unknown"
  set draftSubject to ""
  set draftBody to ""
  set draftMessageId to ""
  set toAddresses to {}
  set ccAddresses to {}
  set bccAddresses to {}

  try
    set accountName to (name of account of targetDraft as text)
  end try
  try
    set draftSubject to (subject of targetDraft as text)
  end try
  try
    set draftBody to (content of targetDraft as text)
  end try
  try
    set draftMessageId to (message id of targetDraft as text)
  end try
  try
    set toAddresses to address of every to recipient of targetDraft
  end try
  try
    set ccAddresses to address of every cc recipient of targetDraft
  end try
  try
    set bccAddresses to address of every bcc recipient of targetDraft
  end try

  set AppleScript's text item delimiters to listDelimiter
  set toText to toAddresses as text
  set ccText to ccAddresses as text
  set bccText to bccAddresses as text

  set AppleScript's text item delimiters to fieldDelimiter
  return (id of targetDraft as text) & fieldDelimiter & accountName & fieldDelimiter & draftSubject & fieldDelimiter & draftBody & fieldDelimiter & toText & fieldDelimiter & ccText & fieldDelimiter & bccText & fieldDelimiter & draftMessageId
end tell
`;
}

function buildCreateDraftScript(input: MailDraftCreateRequest): string {
  return `
set toRecipientsList to ${recipientAddressListLiteral(input.to)}
set ccRecipientsList to ${recipientAddressListLiteral(input.cc)}
set bccRecipientsList to ${recipientAddressListLiteral(input.bcc)}

tell application "Mail"
  set newMessage to make new outgoing message with properties {visible:false, subject:${toAppleScriptStringLiteral(input.subject)}, content:${toAppleScriptStringLiteral(input.bodyText)}}
  tell newMessage
    repeat with recipientValue in toRecipientsList
      make new to recipient at end of to recipients with properties {address:recipientValue}
    end repeat
    repeat with recipientValue in ccRecipientsList
      make new cc recipient at end of cc recipients with properties {address:recipientValue}
    end repeat
    repeat with recipientValue in bccRecipientsList
      make new bcc recipient at end of bcc recipients with properties {address:recipientValue}
    end repeat
  end tell

  set messageIdentifier to (id of newMessage as text)
  set accountName to "Unknown"
  try
    set accountName to name of account of newMessage
  end try
  return messageIdentifier & linefeed & accountName
end tell
`;
}

function buildUpdateDraftScript(input: MailDraftUpdateRequest): string {
  const numericDraftId = Number(input.appleMailId);
  if (!Number.isFinite(numericDraftId)) {
    throw new BridgeError("ValidationFailed", "Draft appleMailId must be numeric");
  }

  const updateRecipients = (recipientKind: "to" | "cc" | "bcc", addresses?: MailAddress[]) => {
    if (!addresses) {
      return "";
    }

    const listName = `${recipientKind}RecipientsList`;
    const recipientClass =
      recipientKind === "to" ? "to recipient" : recipientKind === "cc" ? "cc recipient" : "bcc recipient";
    const recipientProperty =
      recipientKind === "to" ? "to recipients" : recipientKind === "cc" ? "cc recipients" : "bcc recipients";

    return `
set ${listName} to ${recipientAddressListLiteral(addresses)}
tell targetDraft
  repeat with existingRecipient in (${recipientProperty})
    delete existingRecipient
  end repeat
  repeat with recipientValue in ${listName}
    make new ${recipientClass} at end of ${recipientProperty} with properties {address:recipientValue}
  end repeat
end tell
`;
  };

  return `
tell application "Mail"
  set matchingDrafts to (every outgoing message whose id is ${numericDraftId})
  if (count of matchingDrafts) is 0 then error "Can't get draft ${input.appleMailId.replace(/"/g, '\\"')}"
  set targetDraft to item 1 of matchingDrafts
  ${typeof input.subject === "string" ? `set subject of targetDraft to ${toAppleScriptStringLiteral(input.subject)}` : ""}
  ${typeof input.bodyText === "string" ? `set content of targetDraft to ${toAppleScriptStringLiteral(input.bodyText)}` : ""}
  ${updateRecipients("to", input.to)}
  ${updateRecipients("cc", input.cc)}
  ${updateRecipients("bcc", input.bcc)}

  set accountName to "Unknown"
  try
    set accountName to name of account of targetDraft
  end try
  return (id of targetDraft as text) & linefeed & accountName
end tell
`;
}
