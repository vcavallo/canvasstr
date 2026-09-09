import { useMemo } from 'react';
import type { NostrFilter } from '@nostrify/nostrify';
import { collectContributions, DLIST_KINDS, type Contribution } from '@/lib/contributions';
import type { Campaign } from '@/lib/canvasstr';
import { useLiveEvents } from './useLiveEvents';

export interface AuthorContribution { campaign: Campaign; contribution: Contribution }

/** Everything one pubkey has contributed that matches any known campaign's targets. */
export function useAuthorContributions(author: string | undefined, campaigns: Campaign[], relays: string[]) {
  const filters = useMemo<NostrFilter[] | null>(
    () => (author ? [{ kinds: [DLIST_KINDS.ITEM, DLIST_KINDS.ITEM_REGULAR], authors: [author], limit: 500 }] : null),
    [author],
  );
  const allRelays = useMemo(() => {
    const set = new Set(relays);
    for (const c of campaigns) for (const t of c.targets) if (t.relay) set.add(t.relay);
    return [...set];
  }, [campaigns, relays]);
  const live = useLiveEvents(filters, allRelays);
  const items = useMemo<AuthorContribution[]>(() => {
    const out: AuthorContribution[] = [];
    for (const campaign of campaigns) {
      for (const contribution of collectContributions(live.events, campaign.targets, { since: campaign.since })) {
        out.push({ campaign, contribution });
      }
    }
    return out.sort((a, b) => b.contribution.created_at - a.contribution.created_at);
  }, [live.events, campaigns]);
  return { items, eose: live.eose };
}
