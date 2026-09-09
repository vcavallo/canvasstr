import { CheckCircle2, Circle, CircleDollarSign, Copy, XCircle } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { nip19 } from 'nostr-tools';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { AuthorName } from '@/components/AuthorName';
import { ContributionDetails } from './ContributionDetails';
import { Badge } from '@/components/ui/badge';
import { formatSats } from '@/lib/catallax';
import type { LedgerRow } from '@/lib/ledger';
import type { Score } from '@/lib/pov';
import { cn } from '@/lib/utils';
import { RankBadge } from './RankBadge';

const STATUS: Record<LedgerRow['status'], { icon: React.ReactNode; label: string; tone: string }> = {
  candidate: { icon: <Circle className="h-4 w-4" />, label: 'candidate', tone: 'text-muted-foreground' },
  accepted: { icon: <CheckCircle2 className="h-4 w-4" />, label: 'accepted', tone: 'text-blue-600 dark:text-blue-400' },
  paid: { icon: <CircleDollarSign className="h-4 w-4" />, label: 'paid', tone: 'text-green-600 dark:text-green-400' },
  rejected: { icon: <XCircle className="h-4 w-4" />, label: 'rejected', tone: 'text-destructive' },
};

function describe(row: LedgerRow): string {
  const c = row.contribution;
  switch (c.kindOfContribution) {
    case 'profile-tag': return `tagged ${c.taggedRef ? nip19.npubEncode(c.taggedRef).slice(0, 16) + '…' : 'someone'}${c.tagCoord ? ' as ' + c.tagCoord.split(':').pop() : ''}`;
    case 'event-tag': return `tagged an event as ${c.label}`;
    default: return `added "${c.label}"`;
  }
}

export function BoardRow({ row, score, unranked, dim, relays, votes, arbiterView, children }: { row: LedgerRow; score?: Score; unranked?: boolean; dim?: boolean; relays?: string[]; votes?: React.ReactNode; /** Judging aids (submission time, duplicate marker) — arbiter of this campaign only. */ arbiterView?: boolean; children?: React.ReactNode }) {
  const s = STATUS[row.status];
  return (
    <li className={cn('rounded-md border px-3 py-2 transition-colors', row.status === 'paid' && 'bg-green-50 dark:bg-green-950/30', dim && 'opacity-50')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{row.position}</span>
          <AuthorAvatar pubkey={row.contribution.pubkey} className="h-6 w-6 shrink-0" relays={relays} />
          <AuthorName pubkey={row.contribution.pubkey} className="shrink-0 font-medium" relays={relays} />
          <RankBadge score={score} unranked={unranked} />
          <span className="min-w-0 truncate" title={row.contribution.ref}>{describe(row)}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {arbiterView && <time className="text-xs tabular-nums text-muted-foreground" dateTime={new Date(row.contribution.created_at * 1000).toISOString()} title={`${new Date(row.contribution.created_at * 1000).toLocaleString()} (author-claimed time)`}>
            {formatDistanceToNowStrict(row.contribution.created_at * 1000, { addSuffix: true })}
          </time>}
          {arbiterView && row.duplicateOf !== undefined && <Badge variant="outline" className="gap-1 text-muted-foreground" title={row.duplicateOf === 'existing' ? 'This was already on the list before the campaign started' : 'Same item submitted earlier by another contributor'}><Copy className="h-3 w-3" />{row.duplicateOf === 'existing' ? 'already on the list' : `same as #${row.duplicateOf}`}</Badge>}
          {votes}
          {!row.fundable && row.status === 'candidate' && <Badge variant="outline" className="text-muted-foreground">beyond budget</Badge>}
          {row.paidSats !== undefined && <span className="text-sm tabular-nums">{formatSats(row.paidSats)}</span>}
          <span className={cn('flex items-center gap-1 text-sm', s.tone)}>{s.icon}{s.label}</span>
          {children}
        </div>
      </div>
      <ContributionDetails contribution={row.contribution} relays={relays} />
    </li>
  );
}
