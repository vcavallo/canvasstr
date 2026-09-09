# Canvasstr build plan

Decisions taken (2026-09-07):

- Extend NIP.md with tags + one status; no new kinds. (PROTOCOL.md)
- Payout modes: streaming and terminal, per campaign.
- v1 contribution types: list items, event taggings, profile taggings. Lexicon = items on the
  tag concept list.
- Fresh repo, lifting infra from Grantless; not a fork.
- Nobody owns a list. Self-arbitration allowed.
- Relays: tags.brainstorm.world, dcosl.brainstorm.world, relay.grantless.org.
- Tapestry's `feature-magic-carpet` branch and `magic-carpet-chat` are reference only.
- POV-centric reads (PROTOCOL.md §8): lens = URL ?pov, else the logged-in user's own POV, else
  `VITE_DEFAULT_POV` (Vinney: npub18yce33sv4tlgqy53js2s2u8pradnkhkmrpmp0x4x2tvg247p4dzq5m2c5f),
  else NosFabrica house. No POV → prompt to create one on Brainstorm. "View as author" npub box
  bypasses the lens so unknown pubkeys can start participating. Decided 2026-09-07.

## Milestones

### M0 — scaffold ✅
### M1 — protocol layer ✅ (review 0001)
### M1b — lens layer ✅ (review 0002)
### M2 — read-only board ✅ (review 0002)
### M3 — patron flow ✅ (review 0003)
### M4 — arbiter flow ✅ (review 0004)
### M5 — contributor affordances ✅ items only (review 0005); tagging + tag-element forms are follow-ups

Original milestone text kept below for reference.

### M0 — scaffold
Copied infra, docs, empty router. `npm test` green.

### M1 — protocol layer (pure, tested)
- `src/lib/gleaner.ts`: `CampaignInput`, `buildCampaignTemplate` (wraps
  `buildTaskProposalTemplate` and appends the §2 tags), `parseCampaign`, `campaignSlots`,
  `buildAcceptanceTemplate` (3402 per contribution), `buildCampaignFinalTemplate`,
  `parseAcceptance`, `isCampaign`, `latestAuthoritativeCampaign`.
- `src/lib/contributions.ts`: `targetToFilter(target, since)`, `parseContribution` for the four
  target shapes (item, tag-element, event-tagging, profile-tagging), dedupe by `pubkey:d`,
  polarity handling, `matchesTarget`.
- `src/lib/ledger.ts`: join campaign + contributions + 3402s + 9735s into rows
  `{contributor, contribution, status: candidate|accepted|paid|rejected, receiptId, conclusionId}`
  and totals `{slots, accepted, paid, remaining}`.
- Tests for each, using real event fixtures pulled from the brainstorm relays with `nak`.

### M1b — lens layer
- `src/lib/pov.ts`: parse 10040 (bare `30392` row + `30382:rank` row), `rankFilter(events, scores, minRank)`, lens resolution order. `src/hooks/usePov.ts`, `useRanks(pubkeys)` batched 30382 query keyed by provider.
- Lens picker in the header: current lens, `?pov=` support, "view as author" input, min-rank slider, "create your POV on Brainstorm" prompt.

### M2 — read-only board
- `/` : campaigns list (`#t gleaner`) filtered by lens rank of patron, with arbiter rank badge, target, rate, slots, status.
- `/a/:npub` : author view (unranked) of one pubkey's campaigns, contributions, acceptances.
- `/campaign/:naddr` : the live board. Subscribes to contributions (`#z` target), acceptances
  (`#a` campaign), receipts (`#a` campaign). Rows animate from candidate → accepted → paid.
- Profile chips via kind 0; lud16 presence shown (no address = cannot be paid, warn).
- Contributor rank column from the lens; low-rank rows collapsed, never hidden.

### M3 — patron flow
- Create campaign: pick a target (paste a list coordinate, or search DList headers on the
  brainstorm relays), rate, budget, payout mode, arbiter (self or from 33400s), funding type.
- Fund: reuse Grantless `ContributeDialog` for crowdfunding; single-funder zap to arbiter.
- Mark funded → open.

### M4 — arbiter flow
- Judge queue: candidate rows with accept / reject / skip; contribution rendered inline
  (the item's payload, the tagged note, the tagged profile).
- Accept = pay (LNURL to contributor's lud16, WebLN or QR) → wait for 9735 → publish 3402 →
  optional kind 7 `+`. Resurrect upstream `LightningSplitPaymentDialog` loop for terminal
  batch payout.
- Close campaign: final 3402 + `status concluded`, refund remainder.

### M5 — contributor affordances
- "Contribute" button on a campaign that deep-links to Tapestry with the target prefilled, or
  publishes a minimal 39999 item directly for list-item campaigns.
- My contributions / my earnings view.

### M6 — polish
- Seed script for local strfry (campaign + fake contributions), Playwright smoke, deploy.

## Follow-ups (2026-09-09)
- Campaign list has no pagination or filters; will not scale past a few hundred campaigns. Add status/intent filters, sort by rank/recency, and cursor pagination on `created_at`.
- Elevating accepted entries: on accept the arbiter publishes a kind-7 `+`. For tag campaigns the arbiter could also apply the tag under their own key (a second application from a trusted asserter, which Tapestry counts). Longer term: a GrapeRank interpretation that weights "accepted by my preferred arbiters". See discussion with Vinney.
- Arbiter fee is a tip paid on top of escrow (fund UX); not reflected in slots or refunds by design.

## Open risks
- Tapestry emits dual `z` (legacy canonical TA + local TA) on taggings; the target filter must
  accept both namespaces. Ask tapestry which handles to honor for a given deployment.
- `wss://dcosl.brainstorm.world/relay` verified: strfry, stores 9998/9999/39998/39999 and kind 7 only.
- Reference-client and Grantless render a campaign as a funded task with no worker; harmless
  but worth a note upstream once PROTOCOL.md stabilizes.
