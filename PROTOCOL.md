# Gleaner protocol extension to Catallax (NIP-3400)

Status: draft, v0. This document describes how Gleaner uses Catallax kinds 33400 / 33401 / 3402
and NIP-75 kind 9041 to pay many contributors for building up Tapestry decentralized lists
(DLists) and taggings. It adds **no new event kinds**. It adds a handful of tags to 33401 and
3402, one new `status` value, and a convention for issuing one 3402 per accepted contribution.

Read alongside `NIP.md` (unchanged Catallax spec) and Tapestry's `protocols/` (DList and
tagging wire formats).

## 1. Vocabulary

| Catallax term | Gleaner meaning |
|---|---|
| Patron | Creates a **campaign** and funds it (self-funded or crowdfunded via a 9041 goal). |
| Arbiter | Holds escrow, judges each contribution, pays contributors one by one, publishes 3402s. May be the patron. |
| Free agent / worker | A **contributor**: anyone who publishes a DList item or tagging that matches the campaign target. They need not know the campaign exists. |
| Task | A **campaign**: a 33401 with the tags in §2. |
| Conclusion | An **acceptance**: a 3402 per accepted contribution, plus one final 3402 closing the campaign. |

Nobody owns a list. A campaign targets a list *coordinate*; the list header's author has no
special role.

## 2. Campaign: kind 33401 with extension tags

A campaign is an ordinary Catallax task proposal. Everything in NIP.md applies: `d`, `p` patron,
`p` arbiter, `a` arbiter service, `amount` (total escrow in sats), `t catallax`, `status`,
`e … zap` for the escrow receipt, `funding_type` / `goal` for crowdfunding.

**The worker `p` (third `p`) is never set on a campaign.** Existing Catallax clients parse
positionally, so a campaign reads to them as a funded task with no worker, which is accurate.

Added tags:

```
["t", "gleaner"]                                  discovery: all campaigns
["campaign", "curation"]                          marks this 33401 as a multi-contributor campaign
["target", "<z-value>", "<relay-url>", "<hint>"]  what counts; repeatable (see §3)
["rate", "<sats per accepted contribution>"]
["max_per_pubkey", "<n>"]                         optional; default unlimited
["payout", "streaming" | "terminal"]              when the arbiter pays (see §5)
["accepts", "item" | "event-tag" | "profile-tag"] optional, repeatable; default: all
["since", "<unix seconds>"]                       contributions created before this do not count;
                                                  default = created_at of the event that set status "open"
```

`target`, `campaign`, `rate` etc. are multi-letter tags and therefore not relay-indexed. Clients
discover campaigns with `{"kinds":[33401],"#t":["gleaner"]}` and filter by target client-side.
This is deliberate: `a` on a 33401 already means "arbiter service" and `z` on a non-DList event
would be read by Tapestry as list membership, so neither is safe to reuse.

**Slots.** `slots = floor((amount - arbiter_fee) / rate)`. The client shows `slots`,
`accepted`, and `remaining` live. When `remaining` reaches 0 the campaign is full; further
contributions are still visible but flagged as unfunded unless the patron tops up.

**Status.** The Catallax status machine gains one value:

```
proposed → funded → open → concluded
```

`open` replaces `in_progress` for campaigns: the patron (or arbiter) publishes `status open`
once escrow is funded and judging may begin. `submitted` is not used; each contribution is its
own submission. Existing clients treat `open` as an unknown status string and still render
the task.

## 3. Target values and what a contribution is

A `target` value is exactly a Tapestry `z` value, so "everything contributed to this target"
is one relay filter: `{"kinds":[39999, 9999], "#z":["<target>"], "since": <since>}`.

| Campaign wants | `target` value | Contribution event shape (per Tapestry protocols) |
|---|---|---|
| Items added to a list ("restaurants in Toronto") | `39998:<headerAuthor>:<d>` | kind 39999 item with `["z", "<that coordinate>"]` and a `p`/`e`/`a`/`t` payload |
| Lexicon entries (tag definitions) | `39998:<TA>:tag` | kind 39999 tag-element with `["d", slug]`, `["z", "<that>"]`, content `{"tag":{…}}` |
| Posts / list items tagged with tag X | `39999:<tagAuthor>:tagging:<slug>-tagging` | kind 39999 assertion with `["z", "<that>"]`, `["e"\|"a", target]`, `["polarity", "1"]` |
| People tagged with tag X | `39998:<TA>:nostr-user-tag` (+ client-side filter on `["a","39999:<tagAuthor>:<slug>"]`) | kind 39999 with `["p", target]`, `["a", tag coordinate]` |

The `<hint>` element (`item`, `event-tag`, `profile-tag`) tells clients how to render the
match; it is advisory.

Rules for counting a candidate:

- Only events with `created_at >= since` count.
- Addressable contributions (39999) are keyed by `pubkey:d`; the latest version is the one
  judged. Republishing does not create a second slot.
- Taggings with `polarity -1` (disputes) do not count unless the campaign says so in its
  requirements.
- Everything is a **candidate** until the arbiter accepts it. Relay hits are never truth.
- The arbiter may use any web-of-trust signal (a viewer's GrapeRank via kind 30382 / Open
  Ranking) to triage, but WoT never pays anyone; a human accepts.

## 4. Acceptance: one kind 3402 per accepted contribution

For each contribution the arbiter pays, the arbiter publishes a 3402 exactly as in NIP.md,
with the contributor as the worker `p`:

```
["e", "<payout zap receipt id>", "<relay>"]          position 0, as in NIP.md
["e", "<campaign 33401 event id>", "<relay>"]        position 1, as in NIP.md
["p", "<patron>"] ["p", "<arbiter>"] ["p", "<contributor>"]
["resolution", "successful"]
["a", "33401:<patron>:<campaign d>", "<relay>"]
["t", "catallax"] ["t", "gleaner"]
["contribution", "<39999 coordinate or 9999 event id>", "<relay>"]   NEW
["e", "<contribution event id>", "<relay>", "contribution"]          NEW, position ≥ 2, marker "contribution"
```

Existing clients read `e` positionally (payout, task) and ignore the third `e`; the
`contribution` tag is the stable reference for Gleaner clients. The marker-`e` makes
"was this contribution accepted?" answerable with `{"kinds":[3402],"#e":[<contribution id>]}`.

A 3402 with `resolution rejected`, no payout receipt, and the same `contribution` tags records
an explicit rejection. Rejections are optional; silence is the default.

**Closing the campaign.** The arbiter publishes one final 3402 with no worker `p`, resolution
`successful` (slots exhausted or deadline reached) or `cancelled` (patron withdrew), the refund
receipt for any remainder at `e` position 0 (or a mock receipt if nothing to refund), and
`["campaign_final", "1"]`. The patron or arbiter then republishes the 33401 with
`status concluded`.

## 5. Payment

Escrow flows exactly as in Catallax: patron (or crowd, via the 9041 goal) → arbiter's Lightning
address; arbiter → each contributor's Lightning address from their kind 0 (`lud16`/`lud06`).

When the arbiter zaps a contributor, the kind 9734 zap request SHOULD carry:

```
["e", "<contribution event id>"]
["a", "33401:<patron>:<campaign d>"]
["a", "<target coordinate>"]            same convention Tapestry Magic Carpet uses, for interop
["p", "<contributor>"]
```

so the resulting kind 9735 receipt is discoverable with `{"kinds":[9735],"#a":[<campaign>]}`.
The campaign `a` MUST be the first `a` tag: at least one LNURL provider (Coinos) copies only
the first `a` into the receipt. Do not send an LNURL `comment` with a zap; Coinos overwrites
the invoice memo with it and then fails to recognise the zap
and the UI can flip a row to "paid" the moment the receipt lands, before the 3402 arrives.
Receipt trust rule: the payer is the pubkey inside the `description` (9734), never the
receipt signer. A receipt is a trigger to re-read; the 3402 is the record.

`payout streaming`: the arbiter pays and publishes a 3402 as each contribution is accepted,
first-accepted-first-paid until slots run out.

`payout terminal`: the arbiter accepts contributions during the campaign (publishing 3402s
without a payout receipt is NOT allowed; instead the client keeps a local shortlist), then at
the deadline pays every accepted contributor `rate` sats (or, if more were accepted than slots,
splits `amount - fee` evenly) and publishes the 3402s in one batch.

## 6. Endorsement back into the list ecosystem

On acceptance the arbiter's client MAY also publish a NIP-25 kind 7 reaction `+` with
`["e", "<contribution id>"]`, which is the DList NIP's recommended endorsement signal. This
costs nothing and lets Tapestry-aware readers weight accepted items without knowing about
Catallax.

## 7. Open questions

- Should a contributor be able to *claim* explicitly (e.g. a kind 1111 comment on the campaign
  linking their contribution) for cases where the contribution's `z` differs from the target
  (federated namespaces, dual-`z` writes)? v0 answer: no; the arbiter can add a candidate by id.
- Per-target rates within one campaign (tagging pays less than adding an item). v0: one rate;
  make two campaigns.
- Whether Tapestry should learn to read Gleaner 3402s as an endorsement input. Out of scope here.

## 8. Lens: everything is read from a point of view

Gleaner never shows "all campaigns". Every screen is rendered under a **lens**, a pubkey `P`
whose web of trust decides what is visible and how it is ordered. Nothing here gates
publishing; a lens only filters reads.

**Resolving a lens.** For lens pubkey `P`:

1. Fetch `P`'s kind 10040 Treasure Map. Take the `["30382:rank", <provider>, <relay>]` row for
   scores and the bare `["30392", <provider>, <relay>]` row for trusted lists (bare form only;
   `30392:<metric>` rows are inert on deployed readers).
2. Scores for a set of pubkeys: `{"kinds":[30382],"authors":[<provider>],"#d":[<pubkeys>]}` from
   the advertised relay (`wss://nip85.brainstorm.world` for Brainstorm deployments). Chunk the
   `#d` array to ~300 per REQ. On a 30382, `d` is the subject pubkey and the score is
   `["rank", "<0-100 integer as string>"]` (= round(influence × 100)); `hops` and
   `followers` tags are also present and useful for display.
3. A viewer with a 10040 whose providers return nothing has a POV that is not yet computed;
   the UI says so and links to Brainstorm to request calculation.

**Choosing the lens**, in order:

1. `?pov=<npub>` in the URL (shareable views).
2. The logged-in user's own pubkey, if their 10040 resolves.
3. The deployment default, `VITE_DEFAULT_POV` (this deployment: Vinney's pubkey), falling back
   to a house POV. "House" means a Tapestry deployment's assistant key, which signs that
   deployment's 30382s: tags.brainstorm.world is
   `a68dbf561cfe3da1b76f1e65c7d4d9cc116f79921b38a815fd75cb5460b4b599`, tapestry.brainstorm.world is
   `919ba08af7786892093b8264332d817379662a0ba0ba1f5c791ed7b62a7ee2ff`. dcosl.brainstorm.world is a
   bare relay with no assistant. Configure the house provider directly (`VITE_HOUSE_POV_PROVIDER`)
   rather than assuming it has a 10040.

A logged-in user with no POV is prompted once: "Create your point of view on Brainstorm" linking
to a deployment's sign-up page (`/pages/customers/sign-up.html`), and in the meantime browses
under the default lens. Scores typically appear 10–30 minutes after sign-up, up to an hour; the
10040 is published from the Brainstorm account page afterwards. Until both exist the client
keeps using the fallback lens and shows "your POV is not ready yet".

**What the lens filters.** With `minRank` (default 1, adjustable in the UI):

| Object | Filtered by rank of |
|---|---|
| Campaign (33401) | patron; arbiter also shown with its own rank badge |
| Arbiter suggestions on create | rank under the patron's own lens, sorted, never restricted |
| Contribution rows on a board | contributor; low-rank rows are collapsed, never hidden from the arbiter |
| Acceptances (3402) | arbiter |
| Target lists | lists are not pubkeys; a target is visible if any visible campaign references it |

**Author view (escape hatch).** Anyone can enter an npub `A` in the "view as author" box.
The client then shows every campaign, contribution and acceptance authored by `A`, ignoring
the lens entirely and labelling the view "unranked". This is how an unknown pubkey gets
looked at, judged by an arbiter, paid, and starts accruing trust. The escape hatch never
changes the default view for anyone else.

**Why not curator lists.** Grantless scoped reads with hand-curated kind 30392 lists.
Gleaner uses computed GrapeRank scores instead, because Tapestry already publishes them per
observer and a new viewer gets a lens by creating a POV on Brainstorm rather than by finding a
curator. Hand-curated 30392s still work as a lens for a `P` whose 10040 delegates to one.
