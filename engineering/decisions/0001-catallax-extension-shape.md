# ADR 0001: Multi-contributor campaigns on unchanged Catallax kinds

**Status:** Accepted
**Date:** 2026-09-07

## Context

Catallax (NIP-3400) models one task, one worker: clients read the patron, arbiter and worker as
the first three `p` tags of a kind 33401, and a kind 3402 conclusion carries one worker `p` and
one payout receipt. Gleaner needs many contributors per bounty, paid individually after a human
arbiter judges each contribution. Options were: (A) new event kinds; (B) marker-tagged `p`s on
the 33401, which breaks positional parsers in both existing clients; (C) keep the 33401 worker
slot empty and issue one 3402 per accepted contribution.

## Decision

Option C. A campaign is a 33401 with extension tags (`campaign`, `target`, `rate`,
`max_per_pubkey`, `payout`, `since`, `accepts`, `t gleaner`) and a new `status` value `open`.
The worker `p` is never set. Each accepted contribution gets its own 3402 with the contributor
as worker, the payout receipt at `e[0]`, the campaign at `e[1]`, and a marker-`e` plus a
`contribution` tag naming the accepted event. One final 3402 with `campaign_final` closes the
campaign. Full wire shapes are in `PROTOCOL.md` §2–§5.

A contribution is the native Tapestry event (39999 item or tagging with a `z` tag). There is no
wrapper or claim event; the campaign's `target` is a `z` value so discovery is one relay filter.

## Consequences

- Grantless and the reference client parse a campaign as a funded task with no worker and
  ignore the extra tags. They will show several 3402s for one task, which is unusual but not
  an error.
- `target` is a multi-letter tag and is not relay-indexed; campaigns are discovered with
  `#t gleaner` and filtered client-side. Acceptable at expected volumes; revisit if not.
- Neither `a` nor `z` could be reused on the 33401 (`a` = arbiter service; `z` = list
  membership to Tapestry readers).
- NIP.md must gain a section for this; it is the first spec change either fork has made.
