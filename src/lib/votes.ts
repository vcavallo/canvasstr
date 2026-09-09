/**
 * NIP-25 votes on DList items (the DList NIP's endorsement signal): kind 7, content `+`/`-`,
 * `e` = item id and/or `a` = item coordinate. Tallied per contribution *coordinate* so votes
 * survive item republishes, latest vote per voter wins, weighted by the viewer's lens.
 */
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Contribution } from './contributions';
import type { EventTemplate } from './gleaner';
import type { Score } from './pov';

export interface Vote {
  id: string;
  voter: string;
  value: 1 | -1;
  created_at: number;
  /** Event ids the vote points at (`e`). */
  eventIds: string[];
  /** Coordinates the vote points at (`a`, kind 39999 only). */
  coords: string[];
}

export function parseVote(e: NostrEvent): Vote | null {
  if (e.kind !== 7) return null;
  const c = e.content.trim();
  const value: 1 | -1 | null = c === '-' || c === '👎' ? -1 : c === '+' || c === '' || c === '👍' || c === '❤️' ? 1 : null;
  if (value === null) return null;
  const eventIds = e.tags.filter(([n, v]) => n === 'e' && v).map(([, v]) => v);
  const coords = e.tags.filter(([n, v]) => n === 'a' && v?.startsWith('39999:')).map(([, v]) => v);
  if (eventIds.length === 0 && coords.length === 0) return null;
  return { id: e.id, voter: e.pubkey, value, created_at: e.created_at, eventIds, coords };
}

/** Two filters (relays index `#e` and `#a` separately) covering every contribution on a board. */
export function votesFilters(contributions: Pick<Contribution, 'id' | 'ref' | 'kind'>[]): NostrFilter[] {
  const ids = contributions.map((c) => c.id);
  const coords = contributions.filter((c) => c.kind === 39999).map((c) => c.ref);
  const out: NostrFilter[] = [];
  if (ids.length) out.push({ kinds: [7], '#e': ids });
  if (coords.length) out.push({ kinds: [7], '#a': coords });
  return out;
}

export interface Tally {
  up: number;
  down: number;
  /** Votes from pubkeys at or above the lens threshold. */
  upNet: number;
  downNet: number;
  /** The viewer's own latest vote, if any. */
  mine?: 1 | -1;
  voters: string[];
}

export function tallyVotes(
  contributions: Pick<Contribution, 'id' | 'ref' | 'pubkey'>[],
  votes: NostrEvent[],
  opts: { scores?: Map<string, Score>; minRank?: number; viewer?: string } = {},
): Map<string, Tally> {
  const byId = new Map<string, string>();
  for (const c of contributions) byId.set(c.id, c.ref);
  const refs = new Set(contributions.map((c) => c.ref));
  // latest vote per (ref, voter)
  const latest = new Map<string, Vote>();
  for (const e of votes) {
    const v = parseVote(e);
    if (!v) continue;
    const targets = new Set<string>();
    for (const id of v.eventIds) { const r = byId.get(id); if (r) targets.add(r); }
    for (const a of v.coords) if (refs.has(a)) targets.add(a);
    for (const ref of targets) {
      const k = `${ref}|${v.voter}`;
      const prev = latest.get(k);
      if (!prev || v.created_at > prev.created_at) latest.set(k, v);
    }
  }
  const out = new Map<string, Tally>();
  const self = new Map(contributions.map((c) => [c.ref, c.pubkey]));
  for (const [k, v] of latest) {
    const ref = k.slice(0, k.lastIndexOf('|'));
    if (self.get(ref) === v.voter) continue; // no voting for yourself
    const t = out.get(ref) ?? { up: 0, down: 0, upNet: 0, downNet: 0, voters: [] };
    const inNet = opts.scores ? (opts.scores.get(v.voter)?.rank ?? 0) >= (opts.minRank ?? 0) : false;
    if (v.value === 1) { t.up++; if (inNet) t.upNet++; } else { t.down++; if (inNet) t.downNet++; }
    if (opts.viewer && v.voter === opts.viewer) t.mine = v.value;
    t.voters.push(v.voter);
    out.set(ref, t);
  }
  return out;
}

/** A vote that both DList clients and Gleaner can attribute: `e` + `a` + `p` + `k`. */
export function buildVoteTemplate(c: Pick<Contribution, 'id' | 'ref' | 'pubkey' | 'kind'>, value: 1 | -1, relay?: string): EventTemplate {
  const tags: string[][] = [['e', c.id, relay ?? ''], ['p', c.pubkey], ['k', String(c.kind)]];
  if (c.kind === 39999) tags.push(['a', c.ref, relay ?? '']);
  return { kind: 7, content: value === 1 ? '+' : '-', tags };
}
