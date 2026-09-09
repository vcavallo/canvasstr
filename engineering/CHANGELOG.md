# Changelog

- 2026-09-07 — M0 scaffold: infra lifted from Grantless, PROTOCOL.md, PLAN.md, POV lens design.
- 2026-09-07 — M1 protocol layer: campaign/acceptance builders+parsers, contribution matching for all four target shapes, ledger, POV lens primitives. 98 tests, real-relay fixtures.
- 2026-09-07 — M1b+M2: POV lens (10040→30382 ranks, author view, min-rank), live campaign list and campaign board, local seed. Verified in headless Chromium against real relays.
- 2026-09-07 — M3 patron flow: create campaign (target search, arbiter picker), fund (single LNURL or NIP-75 goal), mark funded, open. Verified in headless Chromium.
- 2026-09-07 — M4 arbiter flow: accept&pay (LNURL → 3402 + kind-7), reject, terminal shortlist batch, close/refund. Fixed `since` pinning bug. Verified in headless Chromium.
- 2026-09-07 — M5 contributor flow: publish DList items straight from a campaign; profiles resolve from target relays; "count existing items" option. Tapestry confirmed direct publish is the integration.
- 2026-09-08 — First live Lightning payout via Coinos on relay.grantless.org (review 0006). Fixed: LNURL comment broke Coinos zap receipts.
- 2026-09-08 — Header-driven item form (required/recommended/allowed + field-type from the 39998), full item details on every board row.
- 2026-09-08 — Deployed to Vercel (gleaner-three.vercel.app). Brainstorm integration: HTTP score backend for the lens, one-click POV creation, 10040 publish (ADR 0003).
- 2026-09-09 — NIP-25 votes on contributions: live tally per coordinate, lens-weighted counts (network / total), up/down buttons for logged-in viewers.
- 2026-09-09 — Rows show author-claimed submission time and mark later duplicates of the same item ("same as #N").
