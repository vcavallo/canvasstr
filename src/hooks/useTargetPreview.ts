import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { collectContributions, targetsToFilters, type Contribution } from '@/lib/contributions';
import type { CampaignTarget } from '@/lib/gleaner';

/** Up to `limit` existing entries for a target (and whether there are more), for previews and counts. */
export function useTargetPreview(target: CampaignTarget | undefined, relays: string[], limit = 5) {
  const { nostr } = useNostr();
  const rs = useMemo(() => [...new Set([...(target?.relay ? [target.relay] : []), ...relays])], [target, relays]);
  return useQuery<{ items: Contribution[]; total: number; more: boolean }>({
    queryKey: ['target-preview', target?.z ?? '', target?.tagEventId ?? '', rs, limit],
    enabled: !!target,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const filters = targetsToFilters([target!]).map((f) => ({ ...f, limit: 60 }));
      const events = await nostr.query(filters, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), relays: rs }).catch(() => [] as NostrEvent[]);
      const all = collectContributions(events, [target!]);
      return { items: all.slice(-limit).reverse(), total: all.length, more: events.length >= 60 };
    },
  });
}
