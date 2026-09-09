# Changelog

- 2026-09-09 — Renamed Gleaner → **Canvasstr** (canvasstr.org). Wire tag `t canvasstr`, legacy `t gleaner` still read. Roles: patron / arbiter / canvasser. Tagline "Get paid to build the lexiconomy." Default POV = Vinney's main key (has a 10040). About page.
- 2026-09-09 — Arbiter fee as a tip in the fund flow (never touches slots); "declare a new list" from the picker; "become an arbiter" (33400) from Home and the arbiter picker; About: fee section, NIP links, Trusted Assertions wording. Repo pushed to github.com/vcavallo/canvasstr.

- 2026-09-07 — M0 scaffold: infra lifted from Grantless, PROTOCOL.md, PLAN.md, POV lens design.
- 2026-09-07 — M1 protocol layer: campaign/acceptance builders+parsers, contribution matching for all four target shapes, ledger, POV lens primitives. 98 tests, real-relay fixtures.
- 2026-09-07 — M1b+M2: POV lens (10040→30382 ranks, author view, min-rank), live campaign list and campaign board, local seed. Verified in headless Chromium against real relays.
- 2026-09-07 — M3 patron flow: create campaign (target search, arbiter picker), fund (single LNURL or NIP-75 goal), mark funded, open. Verified in headless Chromium.
- 2026-09-07 — M4 arbiter flow: accept&pay (LNURL → 3402 + kind-7), reject, terminal shortlist batch, close/refund. Fixed `since` pinning bug. Verified in headless Chromium.
- 2026-09-07 — M5 contributor flow: publish DList items straight from a campaign; profiles resolve from target relays; "count existing items" option. Tapestry confirmed direct publish is the integration.
- 2026-09-08 — First live Lightning payout via Coinos on relay.grantless.org (review 0006). Fixed: LNURL comment broke Coinos zap receipts.
- 2026-09-08 — Header-driven item form (required/recommended/allowed + field-type from the 39998), full item details on every board row.
- 2026-09-08 — Deployed to Vercel (canvasstr.org). Brainstorm integration: HTTP score backend for the lens, one-click POV creation, 10040 publish (ADR 0003).
- 2026-09-09 — NIP-25 votes on contributions: live tally per coordinate, lens-weighted counts (network / total), up/down buttons for logged-in viewers.
- 2026-09-09 — Rows show author-claimed submission time and mark later duplicates of the same item ("same as #N").
- 2026-09-09 — Row layout: identity group + right-aligned meta group that wraps as a unit. Arbiter can reverse their own rejection (NIP-09 kind 5 honoured by the ledger).
- 2026-09-09 — Details dialog on every contribution (all fields, content, target, contributor, time, coordinate, raw event); rows show two fields inline.
- 2026-09-09 — Items that predate a campaign show in a collapsed reference section; new duplicates of them are flagged "already on the list" for the arbiter.
- 2026-09-09 — Tag targets: paste a tags.brainstorm.world tag URL or tag coordinate; the board counts profile taggings applying that tag (by `a` coordinate and legacy `e` id, nostr-user-tag family, pins excluded). Verified live against the "podcaster" tag.
- 2026-09-09 — Patron can delete a campaign (NIP-09 by coordinate); list and board honour patron-signed deletions.
- 2026-09-09 — Target search covers tag elements (exact-slug query first); board detects a late/elsewhere escrow receipt and offers "mark funded with this receipt"; receipt lookups also check damus, nos.lol, primal.
- 2026-09-09 — "Tag someone as X" form on tag campaigns (publishes a Tapestry nostr-user-tag assertion; profile search via Brainstorm NIP-50 with observer scoping); tagged profiles show avatar+name in rows and reference rows.
- 2026-09-09 — Intent-first target picker (People / Things / Notes), annotated + lens-ranked results with counts, target preview; profile picker for people-lists (review 0007).
- 2026-09-09 — "Notes or events" intent hidden in the form until note-tagging is ready.
