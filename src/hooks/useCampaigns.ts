import { useMemo } from 'react';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { CATALLAX_KINDS } from '@/lib/catallax';
import { GLEANER_TAG, latestAuthoritativeCampaign, parseCampaign, type Campaign } from '@/lib/gleaner';
import { useLiveEvents } from './useLiveEvents';

const CAMPAIGN_FILTER: NostrFilter[] = [{ kinds: [CATALLAX_KINDS.TASK_PROPOSAL], '#t': [GLEANER_TAG], limit: 500 }];

/** Every campaign on the active relays, latest authoritative version per patron:d. */
export function useCampaigns(extra?: Partial<NostrFilter>) {
  const filters = useMemo<NostrFilter[]>(() => [{ ...CAMPAIGN_FILTER[0], ...extra }], [extra]);
  const { events, eose, error } = useLiveEvents(filters);
  const campaigns = useMemo(() => {
    const groups = new Map<string, NostrEvent[]>();
    for (const e of events) {
      const c = parseCampaign(e);
      if (!c) continue;
      const k = `${c.patronPubkey}:${c.d}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    const out: Campaign[] = [];
    for (const [k, evs] of groups) {
      const [patron, ...rest] = k.split(':');
      const c = latestAuthoritativeCampaign(evs, patron, rest.join(':'));
      if (c) out.push(c);
    }
    return out.sort((a, b) => b.created_at - a.created_at);
  }, [events]);
  return { campaigns, eose, error };
}

/** One campaign by patron + d, live (patron- or arbiter-signed updates included). */
export function useCampaign(patron: string | undefined, d: string | undefined) {
  const filters = useMemo<NostrFilter[]>(
    () => (patron && d ? [{ kinds: [CATALLAX_KINDS.TASK_PROPOSAL], '#d': [d], '#t': [GLEANER_TAG] }] : []),
    [patron, d],
  );
  const live = useLiveEvents(filters.length ? filters : null);
  const campaign = useMemo(() => (patron && d ? latestAuthoritativeCampaign(live.events, patron, d) : null), [live.events, patron, d]);
  return { campaign, eose: live.eose, error: live.error };
}
