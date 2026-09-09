# Engineering record — Canvasstr

A light version of Tapestry's `engineering-team/` harness: the artifacts without the workflow.

```
engineering/
├── README.md        this file
├── CHANGELOG.md     one line per shipped milestone / notable change, newest first
├── decisions/       ADRs: NNNN-slug.md — Status, Date, Context, Decision, Consequences
└── reviews/         review notes after a milestone or a non-trivial diff: NNNN-slug.md
```

Rules of thumb:
- Write an ADR when a choice constrains later work (wire format, storage, trust model), not for
  local refactors. Amend in place with a dated note rather than superseding for small corrections.
- Write a review note when a milestone lands: what was verified, what was skipped, known gaps.
- Protocol facts learned from the Tapestry session go into `PROTOCOL.md`, not here; ADRs link to it.
- Commit early, commit often; the remote is not a gate.
