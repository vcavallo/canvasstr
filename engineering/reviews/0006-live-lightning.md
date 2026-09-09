# Review 0006: first live Lightning payout

**Date:** 2026-09-08
**Scope:** `useLightningZap` (no LNURL comment with zaps), `test/seed` public mode, Coinos dev wallets.

## Setup
- Three Coinos accounts registered via `POST /api/register` bound to the seed keys (arbiter,
  alice, bob); credentials in gitignored `.coinos-dev.json`. Every Coinos address is a zap
  endpoint (`allowsNostr`, zapper pubkey `72bdbc57…`).
- `npm run seed:public` publishes the dev world to `wss://relay.grantless.org` with real
  `lud16`s and no fake receipts/conclusions. relay.grantless.org accepts kinds 0, 7, 3402,
  9735, 33401, 39998, 39999 (probed).
- Vinney funded the arbiter wallet (2,549 sats).

## Run 1 — paid, no receipt (bug found)
Arbiter clicked Accept & pay on "Sushi Kaji"; the script paid the bolt11 from the arbiter's
Coinos wallet (`POST /api/payments {payreq}`); alice's balance rose by 500; **no kind 9735
appeared on any relay**. Cause, from coinos-server source: the LNURL callback overwrites
`invoice.memo` with the `comment` param, and the internal-payment path only calls
`handleZap` when the memo still contains the 9734. Canvasstr was sending its comment as an
LNURL comment. Fix: never send an LNURL comment alongside a zap (the 9734 content carries it).
The row correctly stayed `candidate`: the ledger never trusts a payment without a receipt.

## Run 2 — end to end
"Pizzeria Libretto": invoice → paid → receipt on relay.grantless.org in ~4 s → row flipped
to paid → 3402 published (receipt at `e[0]`, campaign at `e[1]`, `contribution` tag,
marker-`e`) → kind-7 `+` published. Board totals: 1 paid, 3 of 4 slots left.

Receipt shape observed: Coinos copies `p`, the single `e`, and **only the first `a` tag**
from the 9734 (plus `P` = payer). Canvasstr puts the campaign coordinate first, so `#a`
discovery works; the list coordinate is dropped by Coinos. PROTOCOL.md §5 should say the
campaign `a` MUST come first.

## Known gaps surfaced
- A payment that settles without a receipt (run 1) leaves 500 sats with the contributor and no
  record. The arbiter UI should offer "I paid this outside the flow; record with receipt id"
  or at least warn that the sats are gone. Follow-up.
- Remainder for refund is computed from `paid × rate`, so after run 1 it over-states the
  escrow left (shows 1,500, actual 1,000). Needs the arbiter's own outgoing-payment history
  or manual entry. Follow-up.
