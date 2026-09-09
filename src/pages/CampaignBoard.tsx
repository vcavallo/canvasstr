import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '@/components/gleaner/Layout';
import { BoardRow } from '@/components/gleaner/BoardRow';
import { PatronActions } from '@/components/gleaner/PatronActions';
import { ContributeItemDialog } from '@/components/gleaner/ContributeItemDialog';
import { VoteButtons } from '@/components/gleaner/VoteButtons';
import { tallyVotes } from '@/lib/votes';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ArbiterPanel, ArbiterRowControls } from '@/components/gleaner/ArbiterActions';
import { useArbiterActions } from '@/hooks/useArbiterActions';
import { RankBadge } from '@/components/gleaner/RankBadge';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { AuthorName } from '@/components/AuthorName';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppContext } from '@/hooks/useAppContext';
import { useCampaign } from '@/hooks/useCampaigns';
import { useCampaignBoard } from '@/hooks/useCampaignBoard';
import { useLens, useRanks } from '@/hooks/useLens';
import { formatSats } from '@/lib/catallax';
import { decodeCampaignNaddr } from '@/lib/naddr';
import { getActiveRelays } from '@/lib/relays';
import { passesLens } from '@/lib/pov';

const FALLBACK = { patronPubkey: '', d: '', id: '', amount: '0', rate: 1, targets: [], content: { title: '', description: '', requirements: '' }, status: 'proposed', pubkey: '', created_at: 0, categories: [], fundingType: 'single', payout: 'streaming' } as unknown as import('@/lib/gleaner').Campaign;

export default function CampaignBoard() {
  const { naddr } = useParams();
  const addr = decodeCampaignNaddr(naddr);
  const { config, presetRelays } = useAppContext();
  const activeRelays = useMemo(() => getActiveRelays(config, presetRelays), [config, presetRelays]);
  const { campaign, eose: campaignEose } = useCampaign(addr?.pubkey, addr?.identifier);
  const { ledger, votes, eose, relays: boardRelays } = useCampaignBoard(campaign, activeRelays);
  const { user } = useCurrentUser();
  const voterPubkeys = useMemo(() => [...new Set(votes.map((v) => v.pubkey))], [votes]);
  const { lens, minRank } = useLens();
  const arbiter = useArbiterActions(campaign ?? FALLBACK, ledger);
  const pubkeys = useMemo(() => [
    campaign?.patronPubkey ?? '', campaign?.arbiterPubkey ?? '',
    ...(ledger?.rows.map((r) => r.contribution.pubkey) ?? []),
    ...voterPubkeys,
  ].filter(Boolean), [campaign, ledger, voterPubkeys]);
  const ranks = useRanks(lens, pubkeys);
  const scores = useMemo(() => ranks.data ?? new Map<string, import('@/lib/pov').Score>(), [ranks.data]);
  const unranked = lens.source === 'author';
  const weighted = !unranked && (!!lens.provider || !!lens.observer);
  const tallies = useMemo(() => tallyVotes(ledger?.rows.map((r) => r.contribution) ?? [], votes, { scores: weighted ? scores : undefined, minRank, viewer: user?.pubkey }), [ledger, votes, scores, weighted, minRank, user?.pubkey]);

  if (!addr) return <Layout><p className="text-destructive">Not a campaign address.</p></Layout>;
  if (!campaign) {
    return <Layout>{campaignEose ? <p className="text-muted-foreground">No campaign found at this address on the active relays.</p> : <Skeleton className="h-40" />}</Layout>;
  }

  const rows = ledger?.rows ?? [];
  const shownRows = lens.source === 'author' ? rows.filter((r) => r.contribution.pubkey === lens.author) : rows;
  const paidPct = ledger && ledger.slots > 0 ? Math.round((ledger.paid / ledger.slots) * 100) : 0;

  return (
    <Layout>
      <Helmet><title>{campaign.content.title} — Gleaner</title></Helmet>
      <div className="mb-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-semibold">{campaign.content.title}</h2>
          <Badge>{campaign.status}</Badge>
        </div>
        <p className="text-muted-foreground">{campaign.content.description}</p>
        {campaign.content.requirements && <p className="text-sm"><span className="font-medium">Requirements:</span> {campaign.content.requirements}</p>}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2"><AuthorAvatar pubkey={campaign.patronPubkey} className="h-5 w-5" /><AuthorName pubkey={campaign.patronPubkey} /> <span className="text-muted-foreground">patron</span><RankBadge score={scores.get(campaign.patronPubkey)} unranked={unranked} /></span>
          {campaign.arbiterPubkey && <span className="flex items-center gap-2"><AuthorAvatar pubkey={campaign.arbiterPubkey} className="h-5 w-5" /><AuthorName pubkey={campaign.arbiterPubkey} /> <span className="text-muted-foreground">arbiter</span><RankBadge score={scores.get(campaign.arbiterPubkey)} unranked={unranked} /></span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {campaign.targets.map((t) => <Badge key={t.z} variant="outline" className="font-mono text-xs">{t.z}</Badge>)}
        </div>
      </div>

      <div className="mb-6 space-y-3"><PatronActions campaign={campaign} /><ArbiterPanel a={arbiter} campaign={campaign} ledger={ledger} /></div>

      {ledger && (
        <div className="mb-6 rounded-lg border p-4">
          <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><strong>{formatSats(campaign.rate)}</strong> per accepted contribution</span>
            <span><strong>{ledger.paid}</strong> paid</span>
            <span><strong>{ledger.accepted - ledger.paid}</strong> accepted, awaiting receipt</span>
            <span><strong>{ledger.remaining}</strong> of {ledger.slots} slots left</span>
            {ledger.rejected > 0 && <span>{ledger.rejected} rejected</span>}
            {ledger.final && <Badge variant="outline">closed: {ledger.final.resolution}</Badge>}
          </div>
          <Progress value={paidPct} />
        </div>
      )}

      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-center gap-3"><h3 className="font-medium">Contributions</h3><ContributeItemDialog campaign={campaign} relays={activeRelays} /></div>
        <span className="text-sm text-muted-foreground">{eose ? `${shownRows.length} so far` : 'listening…'}</span>
      </div>
      {eose && shownRows.length === 0 && <p className="text-muted-foreground">Nothing yet. Contributions appear here the moment they hit the relays.</p>}
      <ul className="space-y-2">
        {shownRows.map((row) => {
          const dim = !unranked && (!!lens.provider || !!lens.observer) && !!ranks.data && !passesLens(scores, row.contribution.pubkey, minRank) && row.status === 'candidate';
          return (
            <BoardRow key={row.contribution.ref} row={row} score={scores.get(row.contribution.pubkey)} unranked={unranked} dim={dim} relays={boardRelays} arbiterView={arbiter.isArbiter}
              votes={<VoteButtons contribution={row.contribution} tally={tallies.get(row.contribution.ref)} relays={boardRelays} weighted={weighted} />}>
              <ArbiterRowControls row={row} a={arbiter} campaign={campaign} />
            </BoardRow>
          );
        })}
      </ul>
      {ledger && ledger.prior.length > 0 && (
        <details className="mt-6 rounded-md border px-3 py-2 text-sm opacity-70">
          <summary className="cursor-pointer">Already on the list before this campaign ({ledger.prior.length}) — for reference, not eligible</summary>
          <ul className="mt-2 divide-y">
            {ledger.prior.map((c) => (
              <li key={c.ref} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <AuthorAvatar pubkey={c.pubkey} className="h-5 w-5" relays={boardRelays} />
                <AuthorName pubkey={c.pubkey} relays={boardRelays} />
                <span className="min-w-0 flex-1 truncate" title={c.ref}>{c.label}</span>
                <time className="text-xs text-muted-foreground" dateTime={new Date(c.created_at * 1000).toISOString()}>{new Date(c.created_at * 1000).toLocaleDateString()}</time>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-6 text-xs text-muted-foreground"><Link to="/" className="underline">All campaigns</Link></p>
    </Layout>
  );
}
