import { useMemo, useState } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { usePublishTo } from '@/hooks/usePublishTo';
import { useToast } from '@/hooks/useToast';
import { formatSats } from '@/lib/catallax';
import type { Contribution } from '@/lib/contributions';
import { buildAcceptanceTemplate, buildCampaignFinalTemplate, buildCampaignTemplate, buildConclusionRetractionTemplate, buildEndorsementTemplate, campaignCoord, campaignToInput, type Campaign } from '@/lib/canvasstr';
import type { Ledger } from '@/lib/ledger';
import { getActiveRelays } from '@/lib/relays';
import type { PayRequest } from '@/components/canvasstr/PayDialog';

interface Pending { contribution: Contribution; request: PayRequest }

/**
 * Arbiter-side judging. Streaming: accept = pay the contributor, then publish the 3402 with
 * the real receipt and a kind-7 endorsement on the item. Terminal: shortlist locally, then
 * pay the shortlist one by one at the end. Reject publishes a receipt-less 3402. Closing
 * publishes the final 3402 (+ optional refund) and sets the 33401 to concluded.
 */
export function useArbiterActions(campaign: Campaign, ledger: Ledger | null) {
  const { user } = useCurrentUser();
  const { config, presetRelays } = useAppContext();
  const relays = useMemo(() => getActiveRelays(config, presetRelays), [config, presetRelays]);
  const { mutateAsync: publish, isPending } = useNostrPublish();
  const { mutateAsync: publishTo } = usePublishTo();
  const { toast } = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [queue, setQueue] = useState<Contribution[]>([]);
  const [shortlist, setShortlist] = useLocalStorage<string[]>(`canvasstr:shortlist:${campaignCoord(campaign)}`, []);
  const [refund, setRefund] = useState<PayRequest | null>(null);

  const isArbiter = !!user && user.pubkey === campaign.arbiterPubkey;
  const coord = campaignCoord(campaign);
  const fail = (title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : String(e), variant: 'destructive' });

  const targetRelaysFor = (c: Contribution) => [...new Set([...relays, ...(campaign.targets.filter((t) => t.z === c.target && t.relay).map((t) => t.relay!))])];

  const payRequestFor = (c: Contribution): PayRequest => ({
    recipientPubkey: c.pubkey, amountSats: campaign.rate, eventId: c.id, relays: targetRelaysFor(c),
    extraTags: [['a', coord], ['a', c.target]], comment: `Canvasstr: ${campaign.content.title}`,
    title: `Pay ${formatSats(campaign.rate)}`, description: `To the canvasser who added "${c.label}". The acceptance is published once the receipt lands.`,
  });

  /** Accept now (streaming) — opens the pay dialog. */
  const accept = (c: Contribution) => setPending({ contribution: c, request: payRequestFor(c) });

  const recordAcceptance = async (c: Contribution, receipt: NostrEvent) => {
    try {
      await publish(buildAcceptanceTemplate({ campaign, contribution: c.event, payoutReceiptId: receipt.id, resolution: 'successful', relay: relays[0] }));
      await publishTo({ template: buildEndorsementTemplate(c.event, campaign.targets.find((t) => t.z === c.target)?.relay), relays: targetRelaysFor(c) }).catch(() => undefined);
      toast({ title: 'Accepted and paid', description: c.label });
    } catch (e) { fail('Paid, but publishing the acceptance failed', e); }
  };

  const onReceipt = async (receipt: NostrEvent) => {
    if (!pending) return;
    const c = pending.contribution;
    setPending(null);
    await recordAcceptance(c, receipt);
    // terminal batch: continue with the next in the queue
    setQueue((q) => {
      const [next, ...rest] = q;
      if (next) setPending({ contribution: next, request: payRequestFor(next) });
      return rest;
    });
  };

  const reject = async (c: Contribution) => {
    try {
      await publish(buildAcceptanceTemplate({ campaign, contribution: c.event, resolution: 'rejected', relay: relays[0] }));
      setShortlist(shortlist.filter((id) => id !== c.id));
      toast({ title: 'Rejected', description: c.label });
    } catch (e) { fail('Could not publish the rejection', e); }
  };

  /** Reverse a rejection: NIP-09 delete of the arbiter's own 3402. */
  const undoRejection = async (conclusionId: string) => {
    try { await publish(buildConclusionRetractionTemplate(conclusionId, campaign, 'rejection reversed')); toast({ title: 'Rejection reversed' }); }
    catch (e) { fail('Could not reverse the rejection', e); }
  };

  const toggleShortlist = (c: Contribution) => setShortlist(shortlist.includes(c.id) ? shortlist.filter((id) => id !== c.id) : [...shortlist, c.id]);

  /** Terminal: pay every shortlisted candidate, one dialog after another. */
  const payShortlist = () => {
    const rows = (ledger?.rows ?? []).filter((r) => r.status === 'candidate' && shortlist.includes(r.contribution.id)).map((r) => r.contribution);
    if (rows.length === 0) return;
    const [first, ...rest] = rows;
    setQueue(rest);
    setPending({ contribution: first, request: payRequestFor(first) });
  };

  const close = async (resolution: 'successful' | 'cancelled', refundReceipt?: NostrEvent) => {
    try {
      await publish(buildCampaignFinalTemplate({ campaign, resolution, refundReceiptId: refundReceipt?.id }));
      await publish(buildCampaignTemplate({ ...campaignToInput(campaign), status: 'concluded' }));
      toast({ title: 'Campaign closed' });
    } catch (e) { fail('Could not close the campaign', e); }
  };

  const remainderSats = ledger ? Math.max(0, parseInt(campaign.amount, 10) - ledger.paid * campaign.rate) : 0;
  const refundRemainder = () => setRefund({
    recipientPubkey: campaign.patronPubkey, amountSats: remainderSats, eventId: campaign.id, relays, extraTags: [['a', coord]],
    title: `Refund ${formatSats(remainderSats)} to the patron`, description: 'The campaign closes when the receipt lands.',
  });

  return { isArbiter, isPending, pending, refund, shortlist, queue, accept, reject, undoRejection, toggleShortlist, payShortlist, close, refundRemainder, remainderSats, onReceipt, setPending, setRefund };
}

export type ArbiterActions = ReturnType<typeof useArbiterActions>;
