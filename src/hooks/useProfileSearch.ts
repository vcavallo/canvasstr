import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { toHexPubkey } from '@/lib/lensConfig';

export interface ProfileHit { pubkey: string; metadata: NostrMetadata }

/** Brainstorm's NIP-50 proxy: kind-0 search ranked by GrapeRank, POV-scoped via `observer:`. */
export const SEARCH_RELAYS = ['wss://tags.brainstorm.world/relay'];

/**
 * Resolve an npub/hex directly, or NIP-50 search profiles on Brainstorm ranked from the
 * lens observer's point of view (falls back to the house POV for an unknown observer).
 */
export function useProfileSearch(query: string, observer?: string) {
  const { nostr } = useNostr();
  const q = query.trim();
  const hex = toHexPubkey(q);
  return useQuery<ProfileHit[]>({
    queryKey: ['profile-search', hex ?? q, observer ?? ''],
    enabled: q.length >= 2,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const filter = hex
        ? { kinds: [0], authors: [hex], limit: 1 }
        : { kinds: [0], search: `${q}${observer ? ` observer:${observer}` : ''} sort:rank:desc`, limit: 8 };
      const events = await nostr.query([filter], { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), relays: hex ? undefined : SEARCH_RELAYS }).catch(() => [] as NostrEvent[]);
      const seen = new Set<string>();
      const out: ProfileHit[] = [];
      for (const e of events) {
        if (seen.has(e.pubkey)) continue;
        seen.add(e.pubkey);
        try { out.push({ pubkey: e.pubkey, metadata: JSON.parse(e.content) as NostrMetadata }); } catch { out.push({ pubkey: e.pubkey, metadata: {} }); }
      }
      if (hex && out.length === 0) out.push({ pubkey: hex, metadata: {} });
      return out;
    },
  });
}
