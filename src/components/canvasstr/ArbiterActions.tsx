import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatSats } from '@/lib/catallax';
import type { Campaign } from '@/lib/canvasstr';
import type { Ledger, LedgerRow } from '@/lib/ledger';
import type { ArbiterActions } from '@/hooks/useArbiterActions';
import { PayDialog } from './PayDialog';

export function ArbiterRowControls({ row, a, campaign }: { row: LedgerRow; a: ArbiterActions; campaign: Campaign }) {
  if (!a.isArbiter || campaign.status !== 'open') return null;
  if (row.status === 'rejected' && row.acceptance) return <Button size="sm" variant="ghost" className="h-7" disabled={a.isPending} onClick={() => a.undoRejection(row.acceptance!.id)}>Undo rejection</Button>;
  if (row.status !== 'candidate' || row.selfDealing) return null;
  const c = row.contribution;
  const listed = a.shortlist.includes(c.id);
  return (
    <span className="flex items-center gap-1">
      {campaign.payout === 'streaming'
        ? <Button size="sm" className="h-7" disabled={!row.fundable || a.isPending} onClick={() => a.accept(c)}>Accept &amp; pay</Button>
        : <Button size="sm" variant={listed ? 'default' : 'outline'} className="h-7" onClick={() => a.toggleShortlist(c)}>{listed ? 'Shortlisted' : 'Shortlist'}</Button>}
      <Button size="sm" variant="ghost" className="h-7 text-destructive" disabled={a.isPending} onClick={() => a.reject(c)}>Reject</Button>
    </span>
  );
}

export function ArbiterPanel({ a, campaign, ledger }: { a: ArbiterActions; campaign: Campaign; ledger: Ledger | null }) {
  if (!a.isArbiter || campaign.status === 'concluded' || campaign.status === 'proposed') return null;
  const shortlisted = (ledger?.rows ?? []).filter((r) => r.status === 'candidate' && a.shortlist.includes(r.contribution.id)).length;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="font-medium">You are the arbiter.</span>
        {campaign.payout === 'terminal' && campaign.status === 'open' && (
          <Button size="sm" disabled={shortlisted === 0 || !!a.pending} onClick={a.payShortlist}>
            {a.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Pay shortlist ({shortlisted} × {formatSats(campaign.rate)})
          </Button>
        )}
        {a.queue.length > 0 && <span className="text-muted-foreground">{a.queue.length} more queued</span>}
        {campaign.status === 'open' && (
          <>
            {a.remainderSats > 0 && <Button size="sm" variant="outline" onClick={a.refundRemainder}>Refund {formatSats(a.remainderSats)} &amp; close</Button>}
            <Button size="sm" variant="outline" disabled={a.isPending} onClick={() => a.close('successful')}>Close (done)</Button>
            <Button size="sm" variant="ghost" disabled={a.isPending} onClick={() => a.close('cancelled')}>Close (cancelled)</Button>
          </>
        )}
        <PayDialog request={a.pending?.request ?? null} onReceipt={a.onReceipt} onClose={() => { a.setPending(null); }} />
        <PayDialog request={a.refund} onReceipt={(r) => { a.setRefund(null); void a.close('cancelled', r); }} onClose={() => a.setRefund(null)} />
      </CardContent>
    </Card>
  );
}
