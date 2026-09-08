import { Link } from 'react-router-dom';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { AuthorName } from '@/components/AuthorName';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatSats } from '@/lib/catallax';
import { campaignNaddr } from '@/lib/naddr';
import { campaignSlots, type Campaign } from '@/lib/gleaner';
import { classifyTarget } from '@/lib/contributions';
import type { Score } from '@/lib/pov';
import { RankBadge } from './RankBadge';

const STATUS_TONE: Record<Campaign['status'], 'default' | 'secondary' | 'outline'> = {
  proposed: 'outline', funded: 'secondary', open: 'default', concluded: 'outline',
};

export function CampaignCard({ campaign: c, patronScore, arbiterScore, unranked }: {
  campaign: Campaign; patronScore?: Score; arbiterScore?: Score; unranked?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">
            <Link to={`/campaign/${campaignNaddr(c)}`} className="hover:underline">{c.content.title}</Link>
          </CardTitle>
          <Badge variant={STATUS_TONE[c.status]}>{c.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground line-clamp-2">{c.content.description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span><strong>{formatSats(c.rate)}</strong> each</span>
          <span><strong>{campaignSlots(c)}</strong> slots</span>
          <span>escrow <strong>{formatSats(c.amount)}</strong></span>
          <span className="text-muted-foreground">{c.payout} payout</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {c.targets.map((t) => (
            <Badge key={t.z} variant="outline" className="font-mono text-xs" title={t.z}>
              {t.hint ?? classifyTarget(t.z)} · {t.z.split(':').slice(2).join(':') || t.z}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="flex items-center gap-2">
            <AuthorAvatar pubkey={c.patronPubkey} className="h-5 w-5" />
            <AuthorName pubkey={c.patronPubkey} />
            <span className="text-muted-foreground">patron</span>
            <RankBadge score={patronScore} unranked={unranked} />
          </span>
          {c.arbiterPubkey && (
            <span className="flex items-center gap-2">
              <AuthorAvatar pubkey={c.arbiterPubkey} className="h-5 w-5" />
              <AuthorName pubkey={c.arbiterPubkey} />
              <span className="text-muted-foreground">arbiter</span>
              <RankBadge score={arbiterScore} unranked={unranked} />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
