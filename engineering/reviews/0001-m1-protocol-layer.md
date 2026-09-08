# Review 0001: M1 protocol layer

**Date:** 2026-09-07
**Scope:** `src/lib/{gleaner,contributions,ledger,pov}.ts` + tests, `test/fixtures/*.jsonl`

## Verified
- Full gate green: tsc, eslint, 98 unit tests, vite build.
- Campaign 33401s parse under the unchanged Catallax parser with no worker; extension tags
  round-trip through `campaignToInput`. Acceptances parse under `parseTaskConclusion`
  positionally (receipt, task) and expose the contribution via marker-`e` + `contribution`.
- Contribution parsing exercised against real events from tags.brainstorm.world: DList items
  (github-accounts), tag-elements (legacy `tag` namespace), event taggings (dual-`z`, both
  namespaces match), profile taggings (legacy `nostr-user-tag` namespace), per-tag tagging
  header as a narrower target.
- Ledger: receipts count only when the embedded 9734 is signed by the arbiter; 3402s count
  only when signed by the arbiter; patron/arbiter contributions are excluded; `max_per_pubkey`
  and slot exhaustion mark rows unfundable rather than hiding them.
- POV: real 10040s parse to a `30382:rank` provider; a real Amethyst 30382 without a `rank` tag
  is correctly rejected; `#d` chunking at 300.

## Known gaps / follow-ups
- Positional quirk: a `rejected` 3402 with no receipt puts the task id at `e[0]`, so Catallax
  parsers read it as a "payout receipt". Harmless for them (rejected tasks have none), but
  worth a line in the NIP.md addendum.
- `contributionRef` for regular (9999) items is the event id; `ref` in `contributions.ts` agrees.
- Vinney's pubkey has no 10040 on nip85/tags/primal right now; the default lens will fall to the
  house provider until one is published. Consider `VITE_DEFAULT_POV_PROVIDER` to bypass 10040.
- Terminal-payout "even split when over-accepted" is not modelled in the ledger yet (M4).
- No relay hint plumbing on `target` beyond storage; hooks (M2) decide which relays to query.
