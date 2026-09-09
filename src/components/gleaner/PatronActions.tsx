import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useZapGoal } from '@/hooks/useZapGoal';
import { buildZapGoalTemplate, formatSats } from '@/lib/catallax';
import { buildCampaignDeletionTemplate, buildCampaignTemplate, campaignCoord, campaignToInput, type Campaign } from '@/lib/gleaner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { getActiveRelays } from '@/lib/relays';
import { PayDialog, type PayRequest } from './PayDialog';

/**
 * Patron-side lifecycle for a campaign: fund the escrow (single payer → arbiter, or open
 * a NIP-75 goal for the crowd), mark funded, open for contributions. Anyone may
 * contribute to a crowdfund goal. Status changes are republished 33401s (PROTOCOL.md §2).
 */
export function PatronActions({ campaign }: { campaign: Campaign }) {
  const { user } = useCurrentUser();
  const { config, presetRelays } = useAppContext();
  const relays = useMemo(() => getActiveRelays(config, presetRelays), [config, presetRelays]);
  const { mutateAsync: publish, isPending } = useNostrPublish();
  const { toast } = useToast();
  const { data: goalData } = useZapGoal(campaign.goalId);
  const [pay, setPay] = useState<PayRequest | null>(null);
  const navigate = useNavigate();

  const isPatron = user?.pubkey === campaign.patronPubkey;
  const isArbiter = user?.pubkey === campaign.arbiterPubkey;
  const coord = campaignCoord(campaign);
  const crowd = campaign.fundingType === 'crowdfunding';
  const progress = goalData?.progress;

  const republish = async (patch: Partial<ReturnType<typeof campaignToInput>>, msg: string) => {
    try {
      await publish(buildCampaignTemplate({ ...campaignToInput(campaign), ...patch }));
      toast({ title: msg });
    } catch (e) {
      toast({ title: 'Publish failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  /** Republish as funded; with a receipt, add the NIP.md `e … zap` escrow reference. */
  const markFunded = async (receipt?: NostrEvent) => {
    const t = buildCampaignTemplate({ ...campaignToInput(campaign), status: 'funded' });
    if (receipt) t.tags.push(['e', receipt.id, relays[0] ?? '', 'zap']);
    try { await publish(t); toast({ title: 'Marked funded' }); }
    catch (e) { toast({ title: 'Publish failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' }); }
  };

  const openGoal = async () => {
    if (!campaign.arbiterPubkey) return;
    try {
      const goal = await publish(buildZapGoalTemplate({ title: campaign.content.title, description: campaign.content.description, amount: campaign.amount, d: campaign.d }, campaign.patronPubkey, campaign.arbiterPubkey, relays));
      await publish(buildCampaignTemplate({ ...campaignToInput(campaign), goalId: goal.id }));
      toast({ title: 'Crowdfund open', description: 'Anyone can now contribute toward the escrow.' });
    } catch (e) {
      toast({ title: 'Could not open the goal', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  const fundSingle = () => {
    if (!campaign.arbiterPubkey) return;
    setPay({
      recipientPubkey: campaign.arbiterPubkey, amountSats: parseInt(campaign.amount, 10), eventId: campaign.id, relays,
      extraTags: [['a', coord]], title: 'Fund the escrow', description: `${formatSats(campaign.amount)} to the arbiter. The campaign is marked funded when the receipt lands.`,
    });
  };
  const contribute = () => {
    if (!campaign.arbiterPubkey || !campaign.goalId) return;
    setPay({
      recipientPubkey: campaign.arbiterPubkey, amountSats: Math.min(1000, parseInt(campaign.amount, 10)), eventId: campaign.goalId, relays,
      extraTags: [['a', coord]], title: 'Contribute to the escrow', description: 'Sats go to the arbiter, who pays contributors from them.',
    });
  };

  const deleteCampaign = async () => {
    try {
      await publish(buildCampaignDeletionTemplate(campaign, 'campaign deleted by patron'));
      toast({ title: 'Campaign deleted', description: 'Relays that honour deletions will drop it; Gleaner hides it everywhere.' });
      navigate('/');
    } catch (e) { toast({ title: 'Delete failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' }); }
  };
  const deleteControl = isPatron && (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive" disabled={isPending}>Delete campaign</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
          <AlertDialogDescription>Publishes a deletion request (NIP-09) for the campaign. Payments already made and acceptances already published stay on the record. Escrow is not refunded by this.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={deleteCampaign}>Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (!campaign.arbiterPubkey) return <p className="text-sm text-destructive">This campaign has no arbiter and cannot be funded.</p>;
  if (campaign.status === 'concluded') return deleteControl ? <div>{deleteControl}</div> : null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4 text-sm">
        {crowd && (
          <div className="space-y-2">
            <div className="flex items-center justify-between"><span className="font-medium">Crowdfunding</span>
              {progress && <span className="text-muted-foreground">{formatSats(progress.raisedSats)} of {formatSats(progress.targetSats)}</span>}</div>
            {progress && <Progress value={Math.min(100, progress.percentComplete)} />}
            {!campaign.goalId && isPatron && campaign.status === 'proposed' && (
              <Button size="sm" disabled={isPending} onClick={openGoal}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Open for funding</Button>
            )}
            {campaign.goalId && campaign.status === 'proposed' && user && <Button size="sm" variant="secondary" onClick={contribute}>Contribute</Button>}
            {campaign.goalId && campaign.status === 'proposed' && (isPatron || isArbiter) && (
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => markFunded()}>Mark funded{progress && !progress.isGoalMet ? ' anyway' : ''}</Button>
            )}
          </div>
        )}
        {!crowd && isPatron && campaign.status === 'proposed' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={fundSingle}>Fund escrow ({formatSats(campaign.amount)})</Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => markFunded()}>Already paid: mark funded</Button>
          </div>
        )}
        {(isPatron || isArbiter) && campaign.status === 'funded' && (
          <Button size="sm" disabled={isPending} onClick={() => republish({ status: 'open' }, 'Open for contributions')}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Open for contributions</Button>
        )}
        {campaign.status === 'open' && <p className="text-muted-foreground">Open. Contributions to the target lists are being judged by the arbiter.</p>}
        {deleteControl}
        <PayDialog request={pay} onReceipt={(r) => { setPay(null); if (!crowd) void markFunded(r); }} onClose={() => setPay(null)} />
      </CardContent>
    </Card>
  );
}
