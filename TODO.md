# TODO

## Apple Mail

- Add draft sender selection.
  - Extend `mail.drafts.create` and `mail.drafts.update` to accept a sender/account field such as `from` or `account`.
  - Return the resolved sender identity in draft responses instead of only mailbox/account metadata.
  - Verify how Apple Mail chooses the sending account when multiple accounts are configured, then make that selection explicit in the bridge contract.

- Add draft file attachments.
  - Extend draft create/update requests to accept attachment paths on the macOS host.
  - Validate that attachment paths are absolute and readable before invoking Apple Mail automation.
  - Attach files through AppleScript and return normalized attachment metadata in draft responses.

- Add smoke tests for sender/account selection and attachment handling on a real macOS host.
