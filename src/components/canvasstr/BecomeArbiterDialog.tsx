import { useState } from 'react';
import { Gavel, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { buildArbiterAnnouncementTemplate, type FeeType } from '@/lib/catallax';

/** Publish a Catallax kind-33400 arbiter announcement so patrons can pick you. */
export function BecomeArbiterDialog({ compact }: { compact?: boolean }) {
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey);
  const { mutateAsync: publish, isPending } = useNostrPublish();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [feeType, setFeeType] = useState<FeeType>('flat');
  const [feeAmount, setFeeAmount] = useState('0');
  const [error, setError] = useState('');
  if (!user) return null;
  const hasLud = !!(author.data?.metadata?.lud16 || author.data?.metadata?.lud06);

  const submit = async () => {
    setError('');
    try {
      if (!name.trim()) throw new Error('Name your arbiter service, e.g. "Vinney judges lists".');
      const amount = feeType === 'percentage' ? String(Math.min(1, Math.max(0, parseFloat(feeAmount) / 100 || 0))) : String(Math.max(0, parseInt(feeAmount, 10) || 0));
      await publish(buildArbiterAnnouncementTemplate({ pubkey: user.pubkey, name: name.trim(), about: about.trim() || undefined, feeType, feeAmount: amount, categories: ['curation'] }));
      toast({ title: 'You are now an arbiter', description: 'Patrons can pick you when they create a campaign.' });
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm" variant={compact ? 'ghost' : 'outline'}><Gavel className="mr-1 h-4 w-4" />{compact ? 'Announce yourself as an arbiter' : 'Become an arbiter'}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Announce yourself as an arbiter</DialogTitle>
          <DialogDescription>An arbiter holds a campaign's escrow, judges each entry, and pays the good ones. This publishes a Catallax announcement under your key; anyone can do it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="ba-name">Service name</Label><Input id="ba-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fair judge of food lists" /></div>
          <div className="space-y-1"><Label htmlFor="ba-about">What you'll judge, how, and how fast</Label><Textarea id="ba-about" value={about} onChange={(e) => setAbout(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fee</Label>
              <RadioGroup value={feeType} onValueChange={(v) => setFeeType(v as FeeType)}>
                <div className="flex items-center gap-2"><RadioGroupItem id="fee-flat" value="flat" /><Label htmlFor="fee-flat">Flat (sats per campaign)</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem id="fee-pct" value="percentage" /><Label htmlFor="fee-pct">Percent of escrow</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-1"><Label htmlFor="ba-fee">{feeType === 'flat' ? 'Sats' : 'Percent'}</Label><Input id="ba-fee" type="number" min={0} value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Fees are agreed with the patron out of band and paid on top of the escrow. Zero is fine.</p>
          {!hasLud && <p className="text-xs text-destructive">Your profile has no Lightning address (lud16). Patrons cannot fund your escrow until you add one in your Nostr profile.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={isPending} onClick={submit}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish announcement</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
