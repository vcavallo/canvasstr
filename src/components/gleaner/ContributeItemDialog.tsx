import { useState } from 'react';
import { Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePublishTo } from '@/hooks/usePublishTo';
import { useToast } from '@/hooks/useToast';
import { classifyTarget } from '@/lib/contributions';
import { buildDlistItemTemplate } from '@/lib/dlist';
import type { Campaign } from '@/lib/gleaner';

/**
 * Publish a DList item straight from Gleaner for list-item targets. The event is exactly
 * what Tapestry would publish (kind 39999, `z` = list coordinate, `name`), sent to the
 * target's relay plus the active set, so it counts on the board like any other contribution.
 */
export function ContributeItemDialog({ campaign, relays }: { campaign: Campaign; relays: string[] }) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishTo, isPending } = usePublishTo();
  const { toast } = useToast();
  const itemTargets = campaign.targets.filter((t) => (t.hint ?? classifyTarget(t.z)) === 'item');
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(itemTargets[0]?.z ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  if (!user || itemTargets.length === 0 || campaign.status !== 'open') return null;
  const isInsider = user.pubkey === campaign.patronPubkey || user.pubkey === campaign.arbiterPubkey;

  const submit = async () => {
    setError('');
    try {
      const t = itemTargets.find((x) => x.z === target) ?? itemTargets[0];
      const template = buildDlistItemTemplate({ target: t.z, name, description });
      await publishTo({ template, relays: [...new Set([...(t.relay ? [t.relay] : []), ...relays])] });
      toast({ title: 'Added to the list', description: `"${name.trim()}" is now a candidate on this board.` });
      setOpen(false); setName(''); setDescription('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><PlusCircle className="mr-1 h-4 w-4" />Add an item</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an item</DialogTitle>
          <DialogDescription>Publishes a signed list item under your key. The arbiter decides whether it earns {campaign.rate.toLocaleString()} sats.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {itemTargets.length > 1 && (
            <div className="space-y-1"><Label htmlFor="ci-target">List</Label>
              <select id="ci-target" className="w-full rounded-md border bg-background p-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
                {itemTargets.map((t) => <option key={t.z} value={t.z}>{t.z.split(':').slice(2).join(':')}</option>)}
              </select></div>
          )}
          <div className="space-y-1"><Label htmlFor="ci-name">Name</Label><Input id="ci-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ci-desc">Description (optional)</Label><Textarea id="ci-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {isInsider && <p className="text-xs text-muted-foreground">You are the patron or arbiter: your own items never earn from this campaign.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={isPending || !name.trim()} onClick={submit}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish item</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
