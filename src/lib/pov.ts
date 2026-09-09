/**
 * Point-of-view lens: resolve whose scores to read (kind 10040 → provider), read kind 30382
 * ranks, and filter/annotate by rank. Pure. PROTOCOL.md §8, ADR 0002.
 */
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

export const KIND_TREASURE_MAP = 10040;
export const KIND_TRUSTED_ASSERTION = 30382;
export const KIND_TRUSTED_LIST_PUBKEYS = 30392;

export interface Provider {
  pubkey: string;
  relay?: string;
}

export interface LensProviders {
  /** Publisher of `30382` `rank` assertions for this observer. */
  rank?: Provider;
  /** Publisher of `30392` trusted pubkey lists (bare row, PROTOCOL.md §8). */
  trustedLists?: Provider;
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Parse a kind 10040. Bare `30392` rows and `30382:rank` rows only; first occurrence wins. */
export function parseTreasureMap(event: NostrEvent): LensProviders {
  const out: LensProviders = {};
  if (event.kind !== KIND_TREASURE_MAP) return out;
  for (const [key, pubkey, relay] of event.tags) {
    if (!pubkey || !HEX64.test(pubkey)) continue;
    if (key === '30382:rank' && !out.rank) out.rank = { pubkey, relay: relay || undefined };
    else if (key === '30392' && !out.trustedLists) out.trustedLists = { pubkey, relay: relay || undefined };
  }
  return out;
}

export const RANK_CHUNK = 300;

/** Batched filters for the ranks of `subjects` under `provider`, chunked for relay limits. */
export function rankFilters(provider: Provider, subjects: string[]): NostrFilter[] {
  const unique = [...new Set(subjects.filter((s) => HEX64.test(s)))];
  const filters: NostrFilter[] = [];
  for (let i = 0; i < unique.length; i += RANK_CHUNK) {
    filters.push({ kinds: [KIND_TRUSTED_ASSERTION], authors: [provider.pubkey], '#d': unique.slice(i, i + RANK_CHUNK) });
  }
  return filters;
}

export interface Score {
  subject: string;
  /** 0–100 integer. */
  rank: number;
  hops?: number;
  followers?: number;
  created_at: number;
}

export function parseScore(event: NostrEvent, provider?: string): Score | null {
  if (event.kind !== KIND_TRUSTED_ASSERTION) return null;
  if (provider && event.pubkey !== provider) return null;
  const subject = event.tags.find(([n]) => n === 'd')?.[1];
  const rank = Number(event.tags.find(([n]) => n === 'rank')?.[1]);
  if (!subject || !HEX64.test(subject) || !Number.isFinite(rank)) return null;
  const num = (name: string) => {
    const v = event.tags.find(([n]) => n === name)?.[1];
    return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined;
  };
  return { subject, rank, hops: num('hops'), followers: num('followers'), created_at: event.created_at };
}

/** Latest score per subject. */
export function indexScores(events: NostrEvent[], provider?: string): Map<string, Score> {
  const m = new Map<string, Score>();
  for (const e of events) {
    const s = parseScore(e, provider);
    if (!s) continue;
    const prev = m.get(s.subject);
    if (!prev || s.created_at > prev.created_at) m.set(s.subject, s);
  }
  return m;
}

export type LensSource = 'url' | 'self' | 'default' | 'house' | 'author';

export interface Lens {
  /** The observer whose POV this is; undefined for house (provider-only) and author views. */
  observer?: string;
  provider?: Provider;
  source: LensSource;
  /** relay = kind-30382 from the observer's 10040 provider; http = Brainstorm batch API by observer pubkey. */
  via?: 'relay' | 'http';
  /** Author-view: show only this pubkey's events, unranked. */
  author?: string;
}

export interface LensCandidates {
  /** `httpReady` = the observer has a computed POV on Brainstorm even without a 10040. */
  urlPov?: { observer: string; provider?: Provider; httpReady?: boolean };
  self?: { observer: string; provider?: Provider; httpReady?: boolean };
  defaultPov?: { observer: string; provider?: Provider; httpReady?: boolean };
  houseProvider?: Provider;
  author?: string;
}

/** PROTOCOL.md §8 resolution order. A candidate without a resolvable provider is skipped. */
export function resolveLens(c: LensCandidates): Lens {
  if (c.author) return { source: 'author', author: c.author };
  const pick = (source: LensSource, x?: { observer: string; provider?: Provider; httpReady?: boolean }): Lens | null => {
    if (!x) return null;
    if (x.provider) return { source, observer: x.observer, provider: x.provider, via: 'relay' };
    if (x.httpReady) return { source, observer: x.observer, via: 'http' };
    return null;
  };
  return pick('url', c.urlPov) ?? pick('self', c.self) ?? pick('default', c.defaultPov) ?? { source: 'house', provider: c.houseProvider, via: 'relay' };
}

/** Rank of a pubkey under the lens, or undefined when unscored (treated as 0 for filtering). */
export function rankOf(scores: Map<string, Score>, pubkey: string): number | undefined {
  return scores.get(pubkey)?.rank;
}

export function passesLens(scores: Map<string, Score>, pubkey: string, minRank: number): boolean {
  return (rankOf(scores, pubkey) ?? 0) >= minRank;
}
