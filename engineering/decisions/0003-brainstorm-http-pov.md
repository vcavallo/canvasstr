# ADR 0003: Brainstorm HTTP as a second score backend and in-app POV creation

**Status:** Accepted
**Date:** 2026-09-08

## Context
ADR 0002 read scores only from kind 30382 via the observer's kind 10040. Most users (including
the deployment's default observer) have no 10040, and Vinney wants a non-Brainstorm user to get
a point of view by pressing one button in Gleaner. api.brainstorm.world (NosFabrica/brainstorm_server)
exposes, with CORS `*`: challenge login (`/authChallenge/{pk}` + `/verify`, which also creates the
observer's assistant key), `POST /user/graperank` to queue a calculation, `GET /user/history` and
`/user/graperankResult` for status, `GET /setup/{pk}` for 10040 rows, and unauthenticated
`POST /rank/pubkeys` / `POST /stats/pubkey` for scores. All verified live on 2026-09-08.

## Decision
- A lens carries `via: 'relay' | 'http'`. Relay (30382) is preferred when the observer has a
  10040; otherwise HTTP by observer pubkey, but only when Brainstorm confirms the POV is
  computed. Readiness is read from `POST /stats/pubkey` with `algorithm: graperank-pov`,
  because `POST /rank/pubkeys` silently serves global scores for an unknown observer
  (contradicts the server's own docs; observed live). HTTP ranks are 0–1 floats, scaled to
  the 0–100 integer scale used on 30382.
- One-click "Create my point of view": sign the challenge with the user's signer (any login
  type), store the JWT per pubkey in localStorage, queue a calculation, poll every 60 s,
  surface `failure` from `graperankResult`. Once ready, offer "Publish kind 10040" built from
  `/setup/{pk}` rows (only `30382:<metric>` and bare `3039x` rows are kept).
- Brainstorm's per-IP limit (3 calculations / 30 min) and its 30-minute re-trigger cooldown
  (403) are surfaced as errors, not worked around.

## Consequences
- The default lens is Vinney's POV only once it is computed on api.brainstorm.world; until
  then it falls to the house provider over relay. Vinney should press the button once.
- A key with no follows fails calculation (observed with the dev arbiter key); the UI says so.
- `/setup/{pk}` 404s for pubkeys that never logged in; the flow only calls it after login.
- The 30392 trusted-list row is not yet emitted by the live `/setup` (brainstorm_server PR #81
  unmerged); nothing in Gleaner depends on it.
