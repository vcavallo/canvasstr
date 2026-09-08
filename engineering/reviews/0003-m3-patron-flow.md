# Review 0003: M3 patron flow

**Date:** 2026-09-07
**Scope:** `CreateCampaignDialog`, `TargetPicker`, `ArbiterPicker`, `PatronActions`, generic `PayDialog`,
`useDlistHeaders`, `useLightningZap.findReceipt`, `buildZapRequest.extraTags`.

## Verified (headless Chromium, seed patron key, local strfry)
- Log in with nsec → New campaign → search "restaurant" finds the local DList header →
  self-arbitrated → publish → lands on the new board as `proposed` with the fund controls.
- "Already paid: mark funded" → `funded`; "Open for contributions" → `open`. Each is a
  republished 33401 and the board re-renders from the relay echo, not optimistic state.
- No console errors.

## Not verified
- Real Lightning paths (fund escrow, crowdfund contribute): no LNURL endpoint in the dev
  world. The code path is Grantless's proven ContributeDialog generalised; needs a live
  test with a real lud16 before M4 payouts are trusted.
- Header search against the Brainstorm relays in single-relay dev mode fetches those relays
  explicitly and worked in the smoke run (the local list was found; remote ones are included
  in the same query).

## Decisions
- Campaign `since` defaults to the campaign's own `created_at` when unset, so pre-existing
  list items do not count. A patron who wants to reward the backlog sets `since` explicitly
  (not yet exposed in the form; PLAN M6).
- Arbiter picker never restricts: self, any 33400 announcer (sorted by lens rank), or a
  pasted npub. ADR 0002.
- Escrow receipt reference: a second `funded` republish carries `["e", <receipt>, relay, "zap"]`
  only when a receipt was actually observed; "mark funded" without a receipt omits it.
