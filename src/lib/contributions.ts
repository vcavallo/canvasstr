/**
 * Contributions: the native Tapestry events (DList items, tag-elements, event taggings,
 * profile taggings) that a campaign target matches. Pure. PROTOCOL.md §3.
 * Wire shapes per tapestry/protocols (decentralized-lists, tags, event-taggings).
 */
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { CampaignTarget, ContributionKind } from './gleaner';

export const DLIST_KINDS = { HEADER: 39998, HEADER_REGULAR: 9998, ITEM: 39999, ITEM_REGULAR: 9999 } as const;

export interface Contribution {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number;
  /** `kind:pubkey:d` for addressable, event id otherwise. Dedupe key. */
  ref: string;
  /** Which target `z` matched. */
  target: string;
  kindOfContribution: ContributionKind;
  /** Human label for the row: item name, tag slug, or the tagged thing. */
  label: string;
  /** For taggings: the tagged event id / coordinate / pubkey. */
  taggedRef?: string;
  /** For taggings: tag coordinate `39999:<author>:<slug>`. */
  tagCoord?: string;
  polarity: 1 | -1;
  event: NostrEvent;
}

/** Relay filter for everything contributed to a set of targets since `since`. */
export function targetsToFilter(targets: CampaignTarget[], since?: number): NostrFilter {
  const f: NostrFilter = {
    kinds: [DLIST_KINDS.ITEM, DLIST_KINDS.ITEM_REGULAR],
    '#z': targets.map((t) => t.z),
  };
  if (since) f.since = since;
  return f;
}

function tagValues(e: NostrEvent, name: string): string[] {
  return e.tags.filter(([n]) => n === name).map(([, v]) => v).filter(Boolean);
}
function firstTag(e: NostrEvent, name: string): string | undefined {
  return e.tags.find(([n]) => n === name)?.[1];
}

/** Classify by the target's shape rather than the event's, since every user event is 39999. */
export function classifyTarget(z: string): ContributionKind {
  if (/:nostr-user-tag$/.test(z)) return 'profile-tag';
  if (/:nostr-event-tag$/.test(z) || /:tagging:.+-tagging$/.test(z)) return 'event-tag';
  return 'item';
}

export function polarityOf(e: NostrEvent): 1 | -1 {
  const raw = firstTag(e, 'polarity');
  if (raw === undefined) return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n <= -0.5 ? -1 : 1;
}

function labelForItem(e: NostrEvent): string {
  for (const n of ['name', 'title', 'slug']) {
    const v = firstTag(e, n);
    if (v) return v;
  }
  // Tag-elements keep their name in content JSON.
  try {
    const c = JSON.parse(e.content) as Record<string, { name?: string; slug?: string }>;
    for (const v of Object.values(c)) if (v && (v.name || v.slug)) return v.name ?? v.slug ?? '';
  } catch { /* not JSON */ }
  const d = firstTag(e, 'd');
  if (d) return d;
  const payload = e.tags.find(([n]) => ['p', 'e', 'a', 't'].includes(n));
  return payload ? `${payload[0]}:${payload[1]}` : e.id.slice(0, 8);
}

/** Parse one relay hit against the campaign's targets. Null if it matches none. */
export function parseContribution(e: NostrEvent, targets: CampaignTarget[]): Contribution | null {
  if (e.kind !== DLIST_KINDS.ITEM && e.kind !== DLIST_KINDS.ITEM_REGULAR) return null;
  const zs = tagValues(e, 'z');
  const target = targets.find((t) => zs.includes(t.z));
  if (!target) return null;
  const kindOfContribution = target.hint ?? classifyTarget(target.z);
  const d = firstTag(e, 'd') ?? '';
  const ref = e.kind === DLIST_KINDS.ITEM ? `${e.kind}:${e.pubkey}:${d}` : e.id;
  const base = { id: e.id, pubkey: e.pubkey, kind: e.kind, created_at: e.created_at, ref, target: target.z, kindOfContribution, polarity: polarityOf(e), event: e };

  if (kindOfContribution === 'profile-tag') {
    const tagged = firstTag(e, 'p');
    if (!tagged) return null;
    const tagCoord = firstTag(e, 'a');
    return { ...base, label: tagged, taggedRef: tagged, tagCoord };
  }
  if (kindOfContribution === 'event-tag') {
    // Target occupies e/a; the per-tag header is the second z (`39999:<author>:tagging:<slug>-tagging`).
    const tagged = firstTag(e, 'e') ?? firstTag(e, 'a');
    if (!tagged) return null;
    const header = zs.find((z) => /:tagging:.+-tagging$/.test(z));
    const slug = header?.match(/:tagging:(.+)-tagging$/)?.[1];
    return { ...base, label: slug ?? tagged, taggedRef: tagged, tagCoord: header };
  }
  return { ...base, label: labelForItem(e) };
}

/**
 * Parse and dedupe a batch: addressable contributions keep only their latest version
 * (same `ref`), disputes (`polarity -1`) are dropped unless `includeDisputes`, and
 * anything before `since` is excluded.
 */
export function collectContributions(
  events: NostrEvent[],
  targets: CampaignTarget[],
  opts: { since?: number; includeDisputes?: boolean } = {},
): Contribution[] {
  const byRef = new Map<string, Contribution>();
  for (const e of events) {
    if (opts.since && e.created_at < opts.since) continue;
    const c = parseContribution(e, targets);
    if (!c) continue;
    if (c.polarity === -1 && !opts.includeDisputes) continue;
    const prev = byRef.get(c.ref);
    if (!prev || c.created_at > prev.created_at) byRef.set(c.ref, c);
  }
  return [...byRef.values()].sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id));
}
