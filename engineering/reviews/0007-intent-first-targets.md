# Review 0007: intent-first target picker, votes, tag campaigns

**Date:** 2026-09-09
**Scope:** `lib/intent.ts`, `TargetPicker` (rewrite), `TargetOptionRow`, `TargetPreview`, `useTargetPreview`,
`useTagElements`, `TagProfileDialog`, `lib/profileTag.ts`, `useProfileSearch` (Brainstorm NIP-50), votes, deletion.

## Why
Vinney twice targeted the empty "Podcasters" DList header when he meant the "podcaster" tag. "Tag" vs
"list" names the mechanism, not the intent; both are DLists underneath (taggings are items of the
nostr-user-tag concept, narrowed per tag by `a`/`e`).

## What shipped
- **Intent first**: People / Things on a list / Notes or events. People = tag elements + DLists whose
  header has a `p` field; Things = other DLists; Notes = per-tag tagging headers derived from a tag.
- **Annotated results**: "People tagged "podcaster"", "A list of github accounts: one item with
  github-username", author with lens rank, lazy count ("18 so far").
- **POV-scoped**: results sorted by author rank under the lens; below min rank collapsed behind
  "Show N more". Verified: the real Podcaster tag (by straycat, rank 100) ranks first; 10 test-suite
  tags hidden.
- **Preview** after picking: "A contribution is: someone tags a profile as "podcaster"" plus the
  latest existing entries rendered as the board will render them; empty lists say so.
- **Tag-a-profile form** publishing the exact nostr-user-tag shape (dual z, a+e, polarity);
  profile search via Brainstorm's NIP-50 proxy with `observer:` = lens observer.
- People-lists (header requires `p`) get the profile picker in the item form.

## Verified in Chromium
Picker flow end to end on the dev server; tag search exact-slug query; NIP-50 profile search
returns Vitor Pamplona first with NIP-05; reference rows show tagged avatars/names.

## Known gaps
- Notes intent is built on the per-tag tagging-header coordinate but has no "tag a note" form yet.
- Result counts issue one query per visible result (limit 60); fine at current scale.
- Tag concept namespaces are the two known ones (legacy literal + tags TA); other deployments
  need config.
