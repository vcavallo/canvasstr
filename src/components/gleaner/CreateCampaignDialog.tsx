import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLens, useRanks } from '@/hooks/useLens';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useArbiterAnnouncements } from '@/hooks/useCatallax';
import { generateTaskId, type FundingType } from '@/lib/catallax';
import { buildCampaignTemplate, campaignSlots, type CampaignTarget, type PayoutMode } from '@/lib/gleaner';
import { campaignNaddr } from '@/lib/naddr';
import { getActiveRelays } from '@/lib/relays';
import { ArbiterPicker, type ArbiterChoice } from './ArbiterPicker';
import { TargetPicker } from './TargetPicker';

const LIST_RELAYS = ['wss://tags.brainstorm.world/relay', 'wss://dcosl.brainstorm.world/relay'];

export function CreateCampaignDialog() {
  const { user } = useCurrentUser();
  const { config, presetRelays } = useAppContext();
  const { lens } = useLens();
  const { mutateAsync: publish, isPending } = useNostrPublish();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: arbiters = [] } = useArbiterAnnouncements();
  const ranks = useRanks(lens, useMemo(() => arbiters.map((a) => a.arbiterPubkey), [arbiters]));

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [targets, setTargets] = useState<CampaignTarget[]>([]);
  const [rate, setRate] = useState('500');
  const [amount, setAmount] = useState('10000');
  const [maxPerPubkey, setMaxPerPubkey] = useState('');
  const [payout, setPayout] = useState<PayoutMode>('streaming');
  const [fundingType, setFundingType] = useState<FundingType>('single');
  const [arbiter, setArbiter] = useState<ArbiterChoice | undefined>();
  const [countExisting, setCountExisting] = useState(false);
  const [error, setError] = useState('');

  const listRelays = useMemo(() => [...new Set([...LIST_RELAYS, ...getActiveRelays(config, presetRelays)])], [config, presetRelays]);
  const slots = campaignSlots({ amount, rate: Number(rate) || 1 });

  if (!user) return null;

  const submit = async () => {
    setError('');
    try {
      if (!title.trim()) throw new Error('Give the campaign a title.');
      if (targets.length === 0) throw new Error('Pick at least one target list.');
      if (!arbiter) throw new Error('Choose an arbiter (yourself is fine).');
      const template = buildCampaignTemplate({
        d: generateTaskId(title), patronPubkey: user.pubkey, title: title.trim(), description: description.trim(), requirements: requirements.trim(),
        amount: String(parseInt(amount, 10)), rate: parseInt(rate, 10), maxPerPubkey: maxPerPubkey ? parseInt(maxPerPubkey, 10) : undefined,
        payout, fundingType, arbiterPubkey: arbiter.pubkey, arbiterService: arbiter.service, targets, status: 'proposed', since: countExisting ? 1 : Math.floor(Date.now() / 1000),
      });
      const ev = await publish(template);
      toast({ title: 'Campaign published', description: 'Next: fund the escrow, then open it for contributions.' });
      setOpen(false);
      navigate(`/campaign/${campaignNaddr({ patronPubkey: ev.pubkey, d: template.tags.find(([n]) => n === 'd')![1] })}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New campaign</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>Put sats behind building up a list. Contributors just add to the list; the arbiter pays the good ones.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label htmlFor="c-title">Title</Label><Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="c-desc">Description</Label><Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="c-req">What gets paid</Label><Textarea id="c-req" value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="e.g. real restaurants inside Toronto proper, one per item" /></div>
          <div className="space-y-1"><Label>Targets</Label><TargetPicker value={targets} onChange={setTargets} relays={listRelays} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label htmlFor="c-rate">Sats per contribution</Label><Input id="c-rate" type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="c-amount">Total escrow (sats)</Label><Input id="c-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="c-max">Max per person</Label><Input id="c-max" type="number" min={1} value={maxPerPubkey} onChange={(e) => setMaxPerPubkey(e.target.value)} placeholder="∞" /></div>
          </div>
          <p className="text-sm text-muted-foreground">{slots} slots before any arbiter fee.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={countExisting} onChange={(e) => setCountExisting(e.target.checked)} />Also count items already on the list (otherwise only new ones from now on)</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Payout</Label>
              <RadioGroup value={payout} onValueChange={(v) => setPayout(v as PayoutMode)}>
                <div className="flex items-center gap-2"><RadioGroupItem id="p-s" value="streaming" /><Label htmlFor="p-s">Streaming: pay as each is accepted</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem id="p-t" value="terminal" /><Label htmlFor="p-t">Terminal: pay everyone at the end</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-1">
              <Label>Funding</Label>
              <RadioGroup value={fundingType} onValueChange={(v) => setFundingType(v as FundingType)}>
                <div className="flex items-center gap-2"><RadioGroupItem id="f-s" value="single" /><Label htmlFor="f-s">I fund it</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem id="f-c" value="crowdfunding" /><Label htmlFor="f-c">Crowdfund it</Label></div>
              </RadioGroup>
            </div>
          </div>
          <div className="space-y-1"><Label>Arbiter</Label><ArbiterPicker value={arbiter} onChange={setArbiter} scores={ranks.data ?? new Map()} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={isPending} onClick={submit}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish campaign</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
