import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Loader2, Zap } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLightningZap } from '@/hooks/useLightningZap';
import { useToast } from '@/hooks/useToast';

type Phase = 'preparing' | 'invoice' | 'done' | 'timeout' | 'error';

export interface PayRequest {
  recipientPubkey: string;
  amountSats: number;
  /** Event the receipt must reference. */
  eventId: string;
  relays: string[];
  extraTags?: string[][];
  comment?: string;
  title: string;
  description?: string;
}

/**
 * Pay real sats via NIP-57: LNURL → invoice → QR/copy/WebLN → wait for the 9735.
 * Calls `onReceipt` with the real receipt; never fabricates one. Lifted from Grantless's
 * ContributeDialog and made generic (escrow to purser, or payout to contributor).
 */
export function PayDialog({ request, onReceipt, onClose }: { request: PayRequest | null; onReceipt: (receipt: NostrEvent) => void; onClose: () => void }) {
  const { prepareInvoice, payWithWebLN, findReceipt, isWebLNAvailable } = useLightningZap();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('preparing');
  const [invoice, setInvoice] = useState('');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const watch = useRef<AbortController | null>(null);
  const fns = useRef({ prepareInvoice, findReceipt, onReceipt });
  fns.current = { prepareInvoice, findReceipt, onReceipt };

  useEffect(() => {
    watch.current?.abort();
    setPhase('preparing'); setInvoice(''); setQr(''); setError('');
    if (!request) return;
    const ac = new AbortController();
    watch.current = ac;
    (async () => {
      try {
        const { prepareInvoice: prepare, findReceipt: find, onReceipt: done } = fns.current;
        const { invoice: pr } = await prepare({ recipientPubkey: request.recipientPubkey, amountSats: request.amountSats, goalId: request.eventId, relays: request.relays, extraTags: request.extraTags, comment: request.comment });
        if (ac.signal.aborted) return;
        setInvoice(pr); setPhase('invoice');
        const since = Math.floor(Date.now() / 1000) - 30;
        const receipt = await find(request.eventId, request.relays, since, ac.signal);
        if (ac.signal.aborted) return;
        if (receipt) { setPhase('done'); done(receipt); } else setPhase('timeout');
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e)); setPhase('error');
      }
    })();
    return () => ac.abort();
  }, [request]);

  useEffect(() => {
    if (!invoice) return;
    QRCode.toDataURL(`lightning:${invoice}`, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [invoice]);

  const copy = async () => { await navigator.clipboard.writeText(invoice); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const wallet = async () => {
    try { await payWithWebLN(invoice); toast({ title: 'Sent from your wallet', description: 'Waiting for the receipt…' }); }
    catch (e) { toast({ title: 'Wallet payment failed', description: e instanceof Error ? e.message : 'Use the QR or copy the invoice.', variant: 'destructive' }); }
  };

  return (
    <Dialog open={!!request} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          {request?.description && <DialogDescription>{request.description}</DialogDescription>}
        </DialogHeader>
        {phase === 'preparing' && <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching an invoice for {request?.amountSats.toLocaleString()} sats…</p>}
        {phase === 'error' && <p className="text-sm text-destructive">{error}</p>}
        {(phase === 'invoice' || phase === 'done' || phase === 'timeout') && (
          <div className="space-y-4">
            {qr && <div className="flex justify-center"><img src={qr} alt="Lightning invoice QR code" className="rounded-md border" width={240} height={240} /></div>}
            <div className="space-y-1">
              <Label htmlFor="ln-inv" className="text-xs text-muted-foreground">Lightning invoice · {request?.amountSats.toLocaleString()} sats</Label>
              <div className="flex items-center gap-2">
                <Input id="ln-inv" readOnly value={invoice} className="h-8 font-mono text-xs" />
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
              </div>
            </div>
            {isWebLNAvailable && phase === 'invoice' && <Button size="sm" variant="outline" className="w-full" onClick={wallet}><Zap className="mr-2 h-4 w-4" />Pay with browser wallet</Button>}
            {phase === 'invoice' && <p className="flex items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Waiting for the receipt…</p>}
            {phase === 'done' && <p className="text-center text-sm font-medium text-green-600">Receipt seen.</p>}
            {phase === 'timeout' && <p className="text-center text-sm text-muted-foreground">No receipt on the relays yet. If your wallet paid, it will show up on the board when it lands.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
