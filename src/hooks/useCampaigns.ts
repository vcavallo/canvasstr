import { useMemo } from 'react';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { CATALLAX_KINDS } from '@/lib/catallax';
import { DISCOVERY_TAGS, campaignCoord, deletedCampaignCoords, latestAuthoritativeCampaign, parseCampaign, type Campaign } from '@/lib/canvasstr';
import { useLiveEvents } from './useLiveEvents';

const CAMPAIGN_FILTER: NostrFilter[] = [{ kinds: [CATALLAX_KINDS.TASK_PROPOSAL], '#t': DISCOVERY_TAGS, limit: 500 }];
const DELETION_FILTER: NostrFilter = { kinds: [5], '#k': [String(CATALLAX_KINDS.TASK_PROPOSAL)], limit: 500 };

/** Every campaign on the active relays, latest authoritative version per patron:d. */
export function useCampaigns(extra?: Partial<NostrFilter>) {
  const filters = useMemo<NostrFilter[]>(() => [{ ...CAMPAIGN_FILTER[0], ...extra }, DELETION_FILTER], [extra]);
  const { events, eose, error } = useLiveEvents(filters);
  const campaigns = useMemo(() => {
    const groups = new Map<string, NostrEvent[]>();
    for (const e of events) {
      const c = parseCampaign(e);
      if (!c) continue;
      const k = `${c.patronPubkey}:${c.d}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    const deleted = deletedCampaignCoords(events);
    const out: Campaign[] = [];
    for (const [k, evs] of groups) {
      const [patron, ...rest] = k.split(':');
      const c = latestAuthoritativeCampaign(evs, patron, rest.join(':'));
      if (c && !deleted.has(campaignCoord(c))) out.push(c);
    }
    return out.sort((a, b) => b.created_at - a.created_at);
  }, [events]);
  return { campaigns, eose, error };
}

/** One campaign by patron + d, live (patron- or arbiter-signed updates included). */
export function useCampaign(patron: string | undefined, d: string | undefined) {
  const filters = useMemo<NostrFilter[]>(
    () => (patron && d ? [{ kinds: [CATALLAX_KINDS.TASK_PROPOSAL], '#d': [d], '#t': DISCOVERY_TAGS }, { kinds: [5], '#a': [`${CATALLAX_KINDS.TASK_PROPOSAL}:${patron}:${d}`] }] : []),
    [patron, d],
  );
  const live = useLiveEvents(filters.length ? filters : null);
  const deleted = useMemo(() => (patron && d ? deletedCampaignCoords(live.events).has(`${CATALLAX_KINDS.TASK_PROPOSAL}:${patron}:${d}`) : false), [live.events, patron, d]);
  const campaign = useMemo(() => (patron && d && !deleted ? latestAuthoritativeCampaign(live.events, patron, d) : null), [live.events, patron, d, deleted]);
  return { campaign, deleted, eose: live.eose, error: live.error };
}
