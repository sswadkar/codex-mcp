# TODO

## Apple Mail

- Add real macOS smoke tests for sender/account selection and attachment handling.

- Improve past-draft lookup/update ergonomics.
  - The current update path still depends on `appleMailId`.
  - Consider a helper flow that searches recent drafts and resolves a stable selection target before mutation when the caller does not already have a usable draft id.
