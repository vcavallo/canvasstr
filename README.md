# Canvasstr (codename)

Bounties for building up and curating decentralized lists, on Catallax.

A **patron** puts up sats (self-funded or crowdfunded) for the community to add items to a
Tapestry DList, define tags in a lexicon, tag posts, or tag people. Contributors just do the
thing on Nostr as they normally would. An **arbiter** watches the contributions arrive, judges
each one, and pays the good ones from escrow, one contributor at a time. Everyone can watch the
board fill up and the rows flip to *paid*.

Same relationship to Catallax as Grantless: a narrow, opinionated client over unchanged
Catallax kinds. See `PROTOCOL.md` for the extension (new tags, one new status, one 3402 per
accepted contribution) and `PLAN.md` for the build plan.

## Stack

Lifted from Grantless: Vite + React 18 + TypeScript, `@nostrify` (NIP-07 / nsec / NIP-46
signers, NPool), TanStack Query with a persisted cache, shadcn/ui + Tailwind, pure event
builders in `src/lib/catallax.ts` with unit tests, LNURL zap flow in `src/lib/zap.ts`.

```
npm install
npm run relay:up     # local strfry on ws://127.0.0.1:7787 (docker)
npm run seed         # patron/arbiter/contributor dev keys + two campaigns; prints nsecs
npm run dev          # app on the local relay (http://localhost:8080)
npm run dev:public   # app on the public relay set instead
npm test             # tsc + eslint + vitest + build
```

The seed's second campaign targets the real `github-accounts` DList on tags.brainstorm.world,
so even in local mode the board streams live contributions and GrapeRank ranks from the public relays.

## What works (2026-09-07)

- Campaign list and live board under a point-of-view lens (see `PROTOCOL.md` §8).
- Patron: create (target search over the Brainstorm relays), fund (LNURL to arbiter or NIP-75 goal), open.
- Purser (Catallax arbiter): accept & pay (LNURL → real receipt → 3402 + kind-7 endorsement), reject, shortlist for
  terminal payout, close with refund.
- Contributor: add a DList item directly from the campaign; author view for unknown pubkeys.
- Not yet: tagging / tag-element contribution forms, arbiter-fee accounting, a real Lightning test.

Record of decisions and reviews: `engineering/`.

Relays the app reads by default: `wss://tags.brainstorm.world/relay`,
`wss://dcosl.brainstorm.world/relay`, `wss://relay.grantless.org`, plus the usual public ones.
None is privileged; override with `VITE_DEFAULT_RELAY` / `VITE_RELAY_URL`.
