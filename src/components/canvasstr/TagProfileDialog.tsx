import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProfileSearch } from '@/hooks/useProfileSearch';
import { useLens } from '@/hooks/useLens';
import { usePublishTo } from '@/hooks/usePublishTo';
import { useToast } from '@/hooks/useToast';
import { isTagElementTarget } from '@/lib/contributions';
import type { Campaign } from '@/lib/canvasstr';
import { buildProfileTagTemplate } from '@/lib/profileTag';
import { genUserName } from '@/lib/genUserName';

/** Tag a profile with the campaign's tag: publishes a Tapestry nostr-user-tag assertion under your key. */
export function TagProfileDialog({ campaign, relays }: { campaign: Campaign; relays: string[] }) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishTo, isPending } = usePublishTo();
  const { toast } = useToast();
  const tagTargets = campaign.targets.filter(isTagElementTarget);
  const [open, setOpen] = useState(false);
  const [targetZ, setTargetZ] = useState(tagTargets[0]?.z ?? '');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<{ pubkey: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const { lens } = useLens();
  const search = useProfileSearch(chosen ? '' : query, lens.observer);
  const target = tagTargets.find((t) => t.z === targetZ) ?? tagTargets[0];

  if (!user || !target || !target.tagEventId || campaign.status !== 'open') return null;
  const slug = target.z.split(':').slice(2).join(':');
  const isInsider = user.pubkey === campaign.patronPubkey || user.pubkey === campaign.arbiterPubkey;

  const submit = async () => {
    if (!chosen) return;
    setError('');
    try {
      const template = buildProfileTagTemplate({ taggedPubkey: chosen.pubkey, tagCoord: target.z, tagEventId: target.tagEventId!, asserterPubkey: user.pubkey, relay: target.relay });
      await publishTo({ template, relays: [...new Set([...(target.relay ? [target.relay] : []), ...relays])] });
      toast({ title: `Tagged ${chosen.name} as ${slug}`, description: 'It is now a candidate on this board.' });
      setOpen(false); setChosen(null); setQuery('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setChosen(null); setQuery(''); } }}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><UserPlus className="mr-1 h-4 w-4" />Tag someone as {slug}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tag a profile as {slug}</DialogTitle>
          <DialogDescription>Publishes a signed tagging under your key, the same event Tapestry publishes. The arbiter decides whether it earns {campaign.rate.toLocaleString()} sats.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {tagTargets.length > 1 && (
            <select className="w-full rounded-md border bg-background p-2 text-sm" value={target.z} onChange={(e) => setTargetZ(e.target.value)}>
              {tagTargets.map((t) => <option key={t.z} value={t.z}>{t.z.split(':').slice(2).join(':')}</option>)}
            </select>
          )}
          <div className="space-y-1">
            <Label htmlFor="tp-who">Who</Label>
            {chosen ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span className="font-medium">{chosen.name}</span><Button size="sm" variant="ghost" onClick={() => setChosen(null)}>change</Button></div>
            ) : (
              <>
                <Input id="tp-who" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="npub… or search by name" autoFocus />
                {query.trim().length >= 2 && (
                  <ul className="max-h-48 overflow-y-auto rounded-md border text-sm">
                    {search.isLoading && <li className="p-2 text-muted-foreground">Searching…</li>}
                    {!search.isLoading && (search.data ?? []).length === 0 && <li className="p-2 text-muted-foreground">No profiles found.</li>}
                    {(search.data ?? []).map((h) => {
                      const name = h.metadata.display_name || h.metadata.name || genUserName(h.pubkey);
                      return (
                        <li key={h.pubkey}>
                          <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted" onClick={() => setChosen({ pubkey: h.pubkey, name })}>
                            {h.metadata.picture && <img src={h.metadata.picture} alt="" className="h-6 w-6 rounded-full object-cover" />}
                            <span className="font-medium">{name}</span>
                            {h.metadata.nip05 && <span className="truncate text-xs text-muted-foreground">{h.metadata.nip05}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
          {isInsider && <p className="text-xs text-muted-foreground">You are the patron or arbiter: your own taggings never earn from this campaign.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={isPending || !chosen} onClick={submit}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish tagging</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
