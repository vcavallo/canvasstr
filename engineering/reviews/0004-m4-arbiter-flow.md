# Review 0004: M4 arbiter flow

**Date:** 2026-09-07
**Scope:** `useArbiterActions`, `ArbiterRowControls`, `ArbiterPanel`, `usePublishTo`,
`buildEndorsementTemplate`, `since` pinning fix.

## Verified (headless Chromium, seed arbiter key, local strfry)
- Arbiter sees "Accept & pay" / "Reject" on fundable candidate rows only, and the panel with
  close/refund controls only while `open`.
- Reject publishes a receipt-less 3402; the row flips to rejected from the relay echo and the
  totals update (1 → 2 rejected).
- Accept opens the pay dialog for the campaign rate; with the seed's fake `lud16` it fails
  honestly ("Couldn't reach the recipient's Lightning service") and publishes nothing.
- Close (done) publishes the final 3402 and the `concluded` 33401; the board shows the closed
  badge and hides the controls.

## Bug found and fixed
- Republishing a 33401 moved its `created_at`, and the board used `created_at` as the default
  `since`, so every contribution vanished after a status change. `since` is now a required
  campaign input, pinned at first publish and carried through `campaignToInput`. Parser falls
  back to `created_at` for legacy events. Seed and tests updated.

## Not verified
- Real payout: needs an LNURL endpoint. Same code path as M3 funding.
- Terminal-mode batch ("Pay shortlist") sequences PayDialogs via a queue; exercised only by
  type-check. Needs a live run with two real lud16s.
- Kind-7 endorsement publish goes to the target's relays via `usePublishTo`; failures are
  swallowed by design (endorsement is a courtesy, the 3402 is the record).

## Decisions
- Shortlist (terminal mode) is localStorage per campaign coordinate, never an event. Publishing
  "accepted, not yet paid" would create 3402s without receipts, which PROTOCOL.md forbids.
- Self-dealing guard lives in the ledger (patron/arbiter rows are dropped), so the arbiter
  cannot pay themself through the UI even in a self-arbitrated campaign.
- Remainder for refund = `amount - paid × rate`, ignoring arbiter fee for now (fee support is
  a follow-up: read the 33400's `fee_type`/`fee_amount`).
