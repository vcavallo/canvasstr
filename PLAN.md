# Gleaner build plan

Decisions taken (2026-09-07):

- Extend NIP.md with tags + one status; no new kinds. (PROTOCOL.md)
- Payout modes: streaming and terminal, per campaign.
- v1 contribution types: list items, event taggings, profile taggings. Lexicon = items on the
  tag concept list.
- Fresh repo, lifting infra from Grantless; not a fork.
- Nobody owns a list. Self-arbitration allowed.
- Relays: tags.brainstorm.world, dcosl.brainstorm.world, relay.grantless.org.
- Tapestry's `feature-magic-carpet` branch and `magic-carpet-chat` are reference only.

## Milestones

### M0 — scaffold (this commit)
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

### M2 — read-only board
- `/` : campaigns list (`#t gleaner`), with target, rate, slots, status.
- `/campaign/:naddr` : the live board. Subscribes to contributions (`#z` target), acceptances
  (`#a` campaign), receipts (`#a` campaign). Rows animate from candidate → accepted → paid.
- Profile chips via kind 0; lud16 presence shown (no address = cannot be paid, warn).
- Optional GrapeRank column via kind 30382 for the logged-in viewer's POV.

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

## Open risks
- Tapestry emits dual `z` (legacy canonical TA + local TA) on taggings; the target filter must
  accept both namespaces. Ask tapestry which handles to honor for a given deployment.
- `dcosl.brainstorm.world` relay path / NIP-11 not yet verified.
- Reference-client and Grantless render a campaign as a funded task with no worker; harmless
  but worth a note upstream once PROTOCOL.md stabilizes.
