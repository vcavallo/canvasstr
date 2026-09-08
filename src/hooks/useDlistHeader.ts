import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { parseHeaderSchema, type HeaderSchema } from '@/lib/dlist';

/** The kind-39998 header for a list coordinate, from the target's relay plus the active set. */
export function useDlistHeader(coord: string | undefined, relays: string[]) {
  const { nostr } = useNostr();
  return useQuery<{ event: NostrEvent | null; schema: HeaderSchema }>({
    queryKey: ['dlist-header', coord ?? '', relays],
    enabled: !!coord && /^39998:[0-9a-f]{64}:.+$/.test(coord),
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) => {
      const [, pubkey, ...rest] = coord!.split(':');
      const d = rest.join(':');
      const events = await nostr.query([{ kinds: [39998], authors: [pubkey], '#d': [d], limit: 3 }], { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]), relays }).catch(() => [] as NostrEvent[]);
      const event = events.sort((a, b) => b.created_at - a.created_at)[0] ?? null;
      return { event, schema: parseHeaderSchema(event, d) };
    },
  });
}
