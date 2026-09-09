import { useMemo } from 'react';
import type { NostrFilter } from '@nostrify/nostrify';
import { CATALLAX_KINDS } from '@/lib/catallax';
import { collectContributions, targetsToFilter } from '@/lib/contributions';
import { campaignCoord, type Campaign } from '@/lib/gleaner';
import { buildLedger, type Ledger } from '@/lib/ledger';
import { votesFilters } from '@/lib/votes';
import { useLiveEvents } from './useLiveEvents';

/**
 * The live board for one campaign: contributions matching its targets (from the
 * targets' relays plus the active set), the arbiter's 3402s, and zap receipts tagged
 * with the campaign coordinate. All three streams feed one ledger.
 */
export function useCampaignBoard(campaign: Campaign | null, activeRelays: string[]) {
  const coord = campaign ? campaignCoord(campaign) : undefined;
  const since = campaign?.since;

  const contributionFilters = useMemo<NostrFilter[] | null>(
    () => (campaign ? [targetsToFilter(campaign.targets, since)] : null),
    [campaign, since],
  );
  const contributionRelays = useMemo(() => {
    const set = new Set(activeRelays);
    for (const t of campaign?.targets ?? []) if (t.relay) set.add(t.relay);
    return [...set];
  }, [campaign, activeRelays]);
  const settlementFilters = useMemo<NostrFilter[] | null>(
    () => (coord ? [{ kinds: [CATALLAX_KINDS.TASK_CONCLUSION, 9735], '#a': [coord] }] : null),
    [coord],
  );

  const contributions = useLiveEvents(contributionFilters, contributionRelays);
  const settlement = useLiveEvents(settlementFilters);

  const contributionList = useMemo(() => (campaign ? collectContributions(contributions.events, campaign.targets, { since }) : []), [campaign, contributions.events, since]);
  const voteFilters = useMemo<NostrFilter[] | null>(() => (contributionList.length ? votesFilters(contributionList) : null), [contributionList]);
  const votes = useLiveEvents(voteFilters, contributionRelays);

  const ledger = useMemo<Ledger | null>(() => {
    if (!campaign) return null;
    const cs = contributionList;
    const conclusions = settlement.events.filter((e) => e.kind === CATALLAX_KINDS.TASK_CONCLUSION);
    const receipts = settlement.events.filter((e) => e.kind === 9735);
    return buildLedger(campaign, cs, conclusions, receipts);
  }, [campaign, contributionList, settlement.events]);

  return { ledger, votes: votes.events, relays: contributionRelays, eose: contributions.eose && settlement.eose, error: contributions.error ?? settlement.error };
}
