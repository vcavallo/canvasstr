# Gleaner (codename)

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
npm run dev          # http://localhost:8080
npm test             # tsc + eslint + vitest + build
npm run relay:up     # local strfry on ws://127.0.0.1:7787 for dev
```

Relays the app reads by default: `wss://tags.brainstorm.world/relay`,
`wss://dcosl.brainstorm.world/relay`, `wss://relay.grantless.org`, plus the usual public ones.
None is privileged; override with `VITE_DEFAULT_RELAY` / `VITE_RELAY_URL`.
