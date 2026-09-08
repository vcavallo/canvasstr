# Review 0005: M5 contributor flow

**Date:** 2026-09-07
**Scope:** `lib/dlist.ts` + tests, `ContributeItemDialog`, relay-aware `useAuthor`/`AuthorName`/`AuthorAvatar`,
"count existing items" option on create.

## Verified (headless Chromium, seed contributor key)
- "Add an item" on an open list-item campaign publishes a kind-39999 (`z` = list coordinate,
  `name`, optional `description`) to the target relay + active set; the board row count goes
  5 → 6 and the new item shows as a candidate from the relay echo.
- On the campaign targeting the real github-accounts list, contributor names/avatars now
  resolve (kind 0 fetched from the target relays), alongside real ranks.
- Gate: tsc, eslint (0 warnings), 102 tests, build.

## Facts from the tapestry session (2026-09-07)
- Tapestry exposes no prefilled deep link for adding an item, applying a tag, or creating a
  tag-element; contribution affordances are login-gated in-page modals. Direct kind-39999
  publication from Gleaner is the intended integration. Linkable destinations only:
  `/user/<hex>`, `/event?nevent=…`, `/tag/<slug>/<tag-event-id>`, `/tags` on
  tags.brainstorm.world (the reference deployment has no tag UI yet).

## Follow-ups (not built)
- Direct publish forms for the other two contribution kinds: apply a tag to a note/profile
  (event-tagging with dual `z` namespaces + per-tag header) and create a tag-element. Schemas
  are in PROTOCOL.md §3 / tapestry protocols; needs the deployment TA pubkey from
  `/api/assistant/pubkey` (never hardcode) and the legacy `82b75e47…` namespace.
- "View on Tapestry" links on tagging rows (`/user/<hex>`, `/event?id=<hex>`).
- Item payload tags (`p`/`e`/`a`/`t`) per the header's `required` tags: the form only
  emits `name`/`description` today, which is enough for name-only lists but not for
  lists whose header requires `p` or `github-username`-style custom tags.
