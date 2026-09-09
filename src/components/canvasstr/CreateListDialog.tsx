import { useState } from 'react';
import { Loader2, ListPlus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePublishTo } from '@/hooks/usePublishTo';
import { useToast } from '@/hooks/useToast';
import { slugify } from '@/lib/dlist';
import type { CampaignTarget } from '@/lib/canvasstr';

const LIST_RELAYS = ['wss://dcosl.brainstorm.world/relay', 'wss://tags.brainstorm.world/relay'];

/**
 * Declare a new decentralized list (kind 39998 header) when the one you want doesn't exist.
 * Anyone can declare a header; declaring it gives you no control over what gets added.
 */
export function CreateListDialog({ people, relays, onCreated }: { people: boolean; relays: string[]; onCreated: (t: CampaignTarget) => void }) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishTo, isPending } = usePublishTo();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [singular, setSingular] = useState('');
  const [plural, setPlural] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<{ name: string; level: 'required' | 'allowed' }[]>(people ? [] : [{ name: 'name', level: 'required' }]);
  const setField = (i: number, patch: Partial<{ name: string; level: 'required' | 'allowed' }>) => setFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const [error, setError] = useState('');
  if (!user) return null;

  const submit = async () => {
    setError('');
    try {
      const s = singular.trim(), pl = (plural.trim() || `${s}s`);
      if (!s) throw new Error('Give the list a singular name, e.g. "Restaurant".');
      const d = `${slugify(pl)}-${Math.random().toString(36).slice(2, 8)}`;
      const tags: string[][] = [['d', d], ['names', s, pl]];
      if (description.trim()) tags.push(['description', description.trim()]);
      const names = fields.map((f) => ({ ...f, name: f.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') })).filter((f) => f.name && f.name !== 'p');
      if (!people && !names.some((f) => f.level === 'required')) throw new Error('Mark at least one field as required, so items have something to show.');
      if (people) tags.push(['required', 'p', 'the nostr profile']);
      for (const f of names) { tags.push([f.level, f.name]); tags.push(['field-type', f.name, f.name === 'description' ? 'textarea' : 'text']); }
      const rs = [...new Set([...LIST_RELAYS, ...relays])];
      await publishTo({ template: { kind: 39998, content: '', tags }, relays: rs });
      toast({ title: `List "${pl}" declared`, description: 'Anyone can add to it now.' });
      onCreated({ z: `39998:${user.pubkey}:${d}`, relay: LIST_RELAYS[0], hint: 'item' });
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm" variant="ghost"><ListPlus className="mr-1 h-4 w-4" />The list I want doesn't exist yet</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Declare a new list</DialogTitle>
          <DialogDescription>Publishes a list header under your key. You don't own it: anyone can add to it, and your campaign pays for the good additions.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label htmlFor="nl-s">One of them is a…</Label><Input id="nl-s" value={singular} onChange={(e) => setSingular(e.target.value)} placeholder={people ? 'Podcaster' : 'Restaurant'} /></div>
            <div className="space-y-1"><Label htmlFor="nl-p">Plural</Label><Input id="nl-p" value={plural} onChange={(e) => setPlural(e.target.value)} placeholder={people ? 'Podcasters' : 'Restaurants'} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="nl-d">Description</Label><Textarea id="nl-d" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={people ? 'People who host a podcast on nostr' : 'Restaurants inside Toronto proper'} /></div>
          <div className="space-y-1">
            <Label>{people ? 'Extra fields per person (optional)' : 'Fields per item'}</Label>
            {people && <p className="text-xs text-muted-foreground">Each item is a nostr profile; add fields only if canvassers should say more.</p>}
            <div className="space-y-1">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={f.name} onChange={(e) => setField(i, { name: e.target.value })} placeholder={people ? 'podcast-name' : i === 0 ? 'name' : 'neighbourhood'} className="h-8" />
                  <select className="h-8 rounded-md border bg-background px-2 text-sm" value={f.level} onChange={(e) => setField(i, { level: e.target.value as 'required' | 'allowed' })}>
                    <option value="required">required</option>
                    <option value="allowed">optional</option>
                  </select>
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-2" aria-label="Remove field" onClick={() => setFields((x) => x.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setFields((x) => [...x, { name: '', level: 'allowed' }])}><Plus className="mr-1 h-4 w-4" />Add a field</Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={isPending} onClick={submit}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Declare list</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
