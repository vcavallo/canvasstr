# Canvasstr

**Get paid to build the lexiconomy.** Live at [canvasstr.org](https://canvasstr.org).

Canvasstr is a bounty board for curation, built on the [Catallax](https://catallax.network)
protocol over Nostr. A **patron** puts sats behind a decentralized list or a tag; **canvassers**
add entries or tag profiles, from here or from any Nostr app that speaks decentralized lists;
a **purser** holds the escrow, judges each entry, and pays the good ones over Lightning. The
board shows every entry as it arrives, who added it, what your network thinks of them, and
whether it has been paid.

Everything you see is filtered through a **point of view**: a GrapeRank web-of-trust score
computed from one person's network. There is no central curator. Log in and press "Create my
point of view" to have Brainstorm compute yours; until then the site uses the deployment's
default and says so.

The purser is Catallax's arbiter and canvassers are its free agents; the names change per
client, the wire format does not. `PROTOCOL.md` documents the extension: no new event kinds,
a handful of tags on the kind-33401 task, one new `status`, and one kind-3402 conclusion per
accepted entry. The sibling client is [Grantless](https://grantless.org), which applies the same
protocol to crowdfunded grants.

## What it does

- **Campaigns.** Create one against a list ("things on a list") or a tag ("people"), searched
  from the Brainstorm relays with plain-words descriptions and counts, ranked under your lens,
  with a preview of existing entries. Declare a new list if the one you want doesn't exist.
  Fund it yourself over LNURL or crowdfund it with a NIP-75 goal; an optional purser fee is a
  tip on top of the escrow and never touches the slot math.
- **The board.** Live rows for every contribution matching the target, with details, votes
  (NIP-25, weighted by your lens), author-claimed times and duplicate markers for the purser,
  entries that predate the campaign as a reference section, and "own entry, not eligible" for
  the patron's or purser's own submissions.
- **Purser.** Accept and pay (LNURL invoice, real zap receipt, then a 3402 and a kind-7
  endorsement), reject, reverse a rejection, shortlist for terminal payout, close with refund.
  Optionally co-apply the tag under your own key on accept; a co-tagging folds into the row it
  endorses as a "purser co-signed" badge.
- **Canvasser.** Add a list item from a form generated from the list's header schema, or tag a
  profile via Brainstorm's NIP-50 search. Your entry is a signed Nostr event; it exists whether
  or not anyone pays for it.
- **Lens.** Your point of view from your kind-10040 Treasure Map (kind-30382 assertions), or
  from Brainstorm's API if you have no map yet; one-click POV creation and 10040 publishing;
  "view as author" to see everything one pubkey published, unranked.

Not built yet: tagging notes ("notes or events" is hidden in the form), campaign list
pagination and filters. See `PLAN.md` and `engineering/` for the record of decisions and reviews.

## Stack

Vite + React 18 + TypeScript, [`@nostrify`](https://github.com/soapbox-pub/nostrify) (NIP-07,
nsec and NIP-46 signers; relay pool), TanStack Query with a persisted cache, shadcn/ui and
Tailwind. Pure, tested protocol code in `src/lib`: `catallax.ts` (event builders lifted from
Grantless), `canvasstr.ts` (campaigns, acceptances), `contributions.ts` (matching entries to
targets), `ledger.ts` (rows, slots, receipts), `votes.ts`, `pov.ts` and `brainstorm.ts` (lens),
`dlist.ts` and `profileTag.ts` (what canvassers publish), `zap.ts` (LNURL). Test fixtures are
real events pulled from the Brainstorm relays.

## Develop

```
npm install
npm run dev:public   # the app against the public relays (http://localhost:8080)
npm test             # tsc + eslint + vitest + build

npm run relay:up     # optional: local strfry on ws://127.0.0.1:7787 (docker)
npm run seed         # dev keys, two campaigns, fake receipts on the local relay; prints nsecs
npm run dev          # the app against the local relay
npm run seed:public  # dev world on relay.grantless.org with real Coinos addresses, no fake receipts
```

Environment overrides are documented in `.env.example`: default relay, default point of view,
house score provider, receipt relays. No relay and no provider is privileged.

Relays read by default: `wss://relay.grantless.org` (campaigns), `wss://tags.brainstorm.world/relay`
and `wss://dcosl.brainstorm.world/relay` (lists and tags), `wss://nip85.brainstorm.world` (scores),
plus common public relays for profiles and zap receipts.

## Deploy

Static site; deployed to Vercel from this repo (`vercel deploy --prod`). `vercel.json` carries the
SPA rewrite.
