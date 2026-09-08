# Review 0002: M1b lens layer + M2 read-only board

**Date:** 2026-09-07
**Scope:** `src/hooks/{useLiveEvents,useLens,useCampaigns,useCampaignBoard}.ts`,
`src/lib/{lensConfig,naddr}.ts`, `src/components/gleaner/*`, `src/pages/{Home,CampaignBoard,AuthorView}.tsx`,
`test/seed/seed.ts`.

## Verified (headless Chromium against the local strfry + real Brainstorm relays)
- Home lists seeded campaigns; under the house lens with min rank 1 the unscored seed
  patron is hidden and the "N below min rank — show all" control drops the threshold.
- Board for the local "Restaurants in Toronto" campaign renders all row states from real
  event flow: paid via receipt+3402, paid via receipt only, rejected via 3402, candidate.
  Slot totals and progress bar agree with the ledger tests.
- Board for the campaign targeting the REAL `github-accounts` list on tags.brainstorm.world
  streams live 39999 items from that relay even though the app is in single-relay dev mode
  (target relay hints are honoured). Labels come from the `github-username` tag.
- Rank badges resolve from the nip85 relay for real pubkeys (e.g. rank 81 for a real
  contributor under the reference-deployment house provider).
- No console errors beyond React Router v7 future-flag warnings.

## Decisions made in passing
- House provider default is the tapestry.brainstorm.world assistant
  (`919ba08a…`), because the tags.brainstorm.world assistant has published no 30382s.
  Ask tapestry which is meant to be canonical; env-overridable either way.
- `useLiveEvents` batches EVENTs on an 80ms timer to keep React renders sane on backfill.
- `/a/:npub` is sugar for `/?author=<hex>`; author view is URL state so it is shareable.

## Known gaps
- Kind-0 profiles are fetched only from the active relay set, so in single-relay dev mode
  real contributors on the github campaign show without names/avatars. Fix: also query the
  campaign's target relays for kind 0 (M6 polish), or run `dev:public`.
- Zap receipts are read only via `#a` campaign coordinate on the active relays; receipts
  published only to a contributor's own relays are missed (Magic Carpet's "bridge" problem).
  Arbiter flow (M4) will pass the active relays in the 9734 `relays` tag.
- No pagination; campaign list capped at 500 events by filter limit.
- Vinney's default POV has no 10040 yet, so the default lens currently resolves to house.
