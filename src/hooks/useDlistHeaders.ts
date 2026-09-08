import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { DLIST_KINDS } from '@/lib/contributions';

export interface DlistHeader {
  coord: string;
  pubkey: string;
  d: string;
  singular: string;
  plural: string;
  description?: string;
  relay: string;
  event: NostrEvent;
}

export function parseHeader(e: NostrEvent, relay: string): DlistHeader | null {
  if (e.kind !== DLIST_KINDS.HEADER) return null;
  const d = e.tags.find(([n]) => n === 'd')?.[1];
  const names = e.tags.find(([n]) => n === 'names');
  if (!d) return null;
  return {
    coord: `${e.kind}:${e.pubkey}:${d}`, pubkey: e.pubkey, d,
    singular: names?.[1] ?? d, plural: names?.[2] ?? names?.[1] ?? d,
    description: e.tags.find(([n]) => n === 'description')?.[1], relay, event: e,
  };
}

/** Recent DList headers from the given relays (latest per coordinate), searchable client-side. */
export function useDlistHeaders(relays: string[], search: string) {
  const { nostr } = useNostr();
  const q = useQuery<DlistHeader[]>({
    queryKey: ['dlist-headers', relays],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const out = new Map<string, DlistHeader>();
      await Promise.all(relays.map(async (relay) => {
        const events = await nostr.query([{ kinds: [DLIST_KINDS.HEADER], limit: 400 }], { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), relays: [relay] }).catch(() => [] as NostrEvent[]);
        for (const e of events) {
          const h = parseHeader(e, relay);
          if (!h) continue;
          const prev = out.get(h.coord);
          if (!prev || e.created_at > prev.event.created_at) out.set(h.coord, h);
        }
      }));
      return [...out.values()].sort((a, b) => b.event.created_at - a.event.created_at);
    },
  });
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = q.data ?? [];
    if (!needle) return all.slice(0, 50);
    return all.filter((h) => [h.d, h.singular, h.plural, h.description ?? ''].some((s) => s.toLowerCase().includes(needle))).slice(0, 50);
  }, [q.data, search]);
  return { headers: filtered, isLoading: q.isLoading };
}
