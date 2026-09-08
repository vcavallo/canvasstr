import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/gleaner/Layout';
import { CampaignCard } from '@/components/gleaner/CampaignCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useLens, useRanks } from '@/hooks/useLens';
import { passesLens } from '@/lib/pov';

export default function Home() {
  const { lens, minRank, setMinRank } = useLens();
  const { campaigns, eose, error } = useCampaigns();
  const pubkeys = useMemo(() => campaigns.flatMap((c) => [c.patronPubkey, c.arbiterPubkey ?? '']).filter(Boolean), [campaigns]);
  const ranks = useRanks(lens.provider, pubkeys);
  const scores = ranks.data ?? new Map();
  const unranked = lens.source === 'author';

  const visible = campaigns.filter((c) => {
    if (lens.source === 'author') return c.patronPubkey === lens.author || c.arbiterPubkey === lens.author;
    if (!lens.provider || !ranks.data) return true; // no scores yet: show everything, badges say unscored
    return passesLens(scores, c.patronPubkey, minRank);
  });
  const hidden = campaigns.length - visible.length;

  return (
    <Layout>
      <Helmet><title>Gleaner — campaigns</title></Helmet>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Campaigns</h2>
        <span className="text-sm text-muted-foreground">
          {eose ? `${visible.length} shown` : 'loading…'}
          {eose && hidden > 0 && (
            <button type="button" className="ml-2 underline" onClick={() => setMinRank(0)}>{hidden} below min rank — show all</button>
          )}
        </span>
      </div>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {!eose && campaigns.length === 0 && <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>}
      {eose && campaigns.length === 0 && <p className="text-muted-foreground">No campaigns on these relays yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((c) => (
          <CampaignCard key={`${c.patronPubkey}:${c.d}`} campaign={c} unranked={unranked}
            patronScore={scores.get(c.patronPubkey)} arbiterScore={c.arbiterPubkey ? scores.get(c.arbiterPubkey) : undefined} />
        ))}
      </div>
    </Layout>
  );
}
