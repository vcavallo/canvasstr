import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { BRAINSTORM_API } from '@/lib/brainstorm';
import { toHexPubkey } from '@/lib/lensConfig';

export interface ProfileHit { pubkey: string; metadata: NostrMetadata; rank?: number }

const PROFILE_RELAYS = ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://purplepag.es'];

/**
 * Resolve an npub/hex directly, or search by name through Brainstorm's Open Ranking
 * profile search (global GrapeRank order; the endpoint does not take a POV yet), then
 * fetch the kind-0s for the hits.
 */
export function useProfileSearch(query: string) {
  const { nostr } = useNostr();
  const q = query.trim();
  const hex = toHexPubkey(q);
  return useQuery<ProfileHit[]>({
    queryKey: ['profile-search', hex ?? q],
    enabled: q.length >= 2,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      let ranked: { pubkey: string; rank?: number }[] = [];
      if (hex) ranked = [{ pubkey: hex }];
      else {
        const res = await fetch(`${BRAINSTORM_API}/search/pubkeys`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q, limit: 8 }), signal }).catch(() => null);
        const body = res && res.ok ? ((await res.json()) as { results?: { pubkey: string; rank: number }[] }) : null;
        ranked = body?.results ?? [];
      }
      if (ranked.length === 0) return [];
      const events = await nostr.query([{ kinds: [0], authors: ranked.map((r) => r.pubkey) }], { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]), relays: PROFILE_RELAYS }).catch(() => [] as NostrEvent[]);
      const latest = new Map<string, NostrEvent>();
      for (const e of events) { const p = latest.get(e.pubkey); if (!p || e.created_at > p.created_at) latest.set(e.pubkey, e); }
      return ranked.map((r) => {
        const e = latest.get(r.pubkey);
        let metadata: NostrMetadata = {};
        try { metadata = e ? (JSON.parse(e.content) as NostrMetadata) : {}; } catch { /* keep empty */ }
        return { pubkey: r.pubkey, metadata, rank: r.rank };
      });
    },
  });
}
