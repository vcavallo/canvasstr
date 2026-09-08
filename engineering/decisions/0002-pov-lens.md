# ADR 0002: Every read goes through a point-of-view lens

**Status:** Accepted
**Date:** 2026-09-07

## Context

Discovery by `#t gleaner` returns every campaign anyone published. Grantless solved the same
problem with hand-curated kind 30392 lists per curator. Tapestry already computes GrapeRank per
observer and publishes scores as kind 30382, discoverable through the observer's kind 10040.

## Decision

Gleaner is POV-centric. The lens is resolved as: `?pov=` URL param, else the logged-in user's
own 10040, else `VITE_DEFAULT_POV` (Vinney), else a configured house provider (a Tapestry
deployment assistant key). Scores are read as `{"kinds":[30382],"authors":[provider],"#d":[…]}`
with the `rank` tag (0–100). The lens filters and orders reads only; publishing is never gated.
A "view as author" input bypasses the lens for one pubkey so unknown participants can be seen,
judged and paid. Users without a POV are sent to a Brainstorm sign-up page. Details in
`PROTOCOL.md` §8.

## Consequences

- Grantless's curator code is not reused; hand-curated 30392s still work if a lens's 10040
  delegates to one.
- The client depends on the nip85 relay being reachable; if not, it degrades to unranked with a
  visible notice.
- Score lookups must be batched and chunked (~300 subjects per REQ).
