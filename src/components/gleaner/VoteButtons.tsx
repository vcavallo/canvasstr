import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePublishTo } from '@/hooks/usePublishTo';
import { useToast } from '@/hooks/useToast';
import type { Contribution } from '@/lib/contributions';
import { cn } from '@/lib/utils';
import { buildVoteTemplate, type Tally } from '@/lib/votes';

/**
 * NIP-25 up/down on a contribution. Bold = votes from the viewer's network (lens ≥ min rank),
 * muted = everyone. Buttons publish to the target's relays; the viewer's own vote is highlighted.
 * Progressive: renders counts as soon as the vote subscription answers, never blocks the row.
 */
export function VoteButtons({ contribution: c, tally, relays, weighted }: { contribution: Contribution; tally?: Tally; relays: string[]; weighted: boolean }) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishTo, isPending } = usePublishTo();
  const { toast } = useToast();
  const canVote = !!user && user.pubkey !== c.pubkey;

  const cast = async (value: 1 | -1) => {
    try { await publishTo({ template: buildVoteTemplate(c, value, relays[0]), relays }); }
    catch (e) { toast({ title: 'Vote not published', description: e instanceof Error ? e.message : String(e), variant: 'destructive' }); }
  };

  const Arrow = ({ value, icon, net, total }: { value: 1 | -1; icon: React.ReactNode; net: number; total: number }) => (
    <Button size="sm" variant="ghost" className={cn('h-7 gap-1 px-1.5 tabular-nums', tally?.mine === value && 'bg-muted font-semibold')}
      disabled={!canVote || isPending || tally?.mine === value} onClick={() => cast(value)}
      title={weighted ? `${net} from your network, ${total} total` : `${total} total`}>
      {icon}
      {weighted ? <><span>{net}</span><span className="text-muted-foreground">/{total}</span></> : <span>{total}</span>}
    </Button>
  );

  return (
    <span className="flex items-center">
      <Arrow value={1} icon={<ArrowUp className="h-4 w-4" />} net={tally?.upNet ?? 0} total={tally?.up ?? 0} />
      <Arrow value={-1} icon={<ArrowDown className="h-4 w-4" />} net={tally?.downNet ?? 0} total={tally?.down ?? 0} />
    </span>
  );
}
