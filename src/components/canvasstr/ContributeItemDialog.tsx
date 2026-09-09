import { useMemo, useState } from 'react';
import { Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLens } from '@/hooks/useLens';
import { useProfileSearch } from '@/hooks/useProfileSearch';
import { genUserName } from '@/lib/genUserName';
import { useDlistHeader } from '@/hooks/useDlistHeader';
import { usePublishTo } from '@/hooks/usePublishTo';
import { useToast } from '@/hooks/useToast';
import { classifyTarget } from '@/lib/contributions';
import { buildDlistItemTemplate, randomSuffix, STANDARD_OPTIONAL } from '@/lib/dlist';
import type { Campaign } from '@/lib/canvasstr';

/**
 * Publish a DList item straight from Canvasstr. The form is generated from the target list's
 * kind-39998 header: `required` fields are marked, `recommended`/`allowed` are optional,
 * `field-type` picks the input. The event is exactly what Tapestry would publish.
 */
export function ContributeItemDialog({ campaign, relays }: { campaign: Campaign; relays: string[] }) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishTo, isPending } = usePublishTo();
  const { toast } = useToast();
  const itemTargets = campaign.targets.filter((t) => (t.hint ?? classifyTarget(t.z)) === 'item');
  const [open, setOpen] = useState(false);
  const [targetZ, setTargetZ] = useState(itemTargets[0]?.z ?? '');
  const target = itemTargets.find((t) => t.z === targetZ) ?? itemTargets[0];
  const headerRelays = useMemo(() => [...new Set([...(target?.relay ? [target.relay] : []), ...relays])], [target, relays]);
  const header = useDlistHeader(target?.z, headerRelays);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [who, setWho] = useState('');
  const { lens } = useLens();
  const whoSearch = useProfileSearch(values.p ? '' : who, lens.observer);
  const [whoName, setWhoName] = useState('');

  if (!user || itemTargets.length === 0 || campaign.status !== 'open' || !target) return null;
  const isInsider = user.pubkey === campaign.patronPubkey || user.pubkey === campaign.arbiterPubkey;
  const schema = header.data?.schema;
  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!schema) return;
    setError('');
    try {
      const template = buildDlistItemTemplate({ target: target.z, fields: values, schema, suffix: randomSuffix() });
      await publishTo({ template, relays: headerRelays });
      toast({ title: `Added a ${schema.singular}`, description: 'It is now a candidate on this board.' });
      setOpen(false); setValues({});
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const extraOptional = schema ? STANDARD_OPTIONAL.filter((k) => !schema.fields.some((f) => f.name === k) && !schema.disallowed.includes(k)) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><PlusCircle className="mr-1 h-4 w-4" />Add {schema ? `a ${schema.singular}` : 'an item'}</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {schema ? `a ${schema.singular}` : 'an item'}</DialogTitle>
          <DialogDescription>
            {schema?.description ? `${schema.description}. ` : ''}Publishes a signed list item under your key (you are the canvasser). The purser decides whether it earns {campaign.rate.toLocaleString()} sats.
          </DialogDescription>
        </DialogHeader>
        {header.isLoading ? <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading the list's header…</p> : (
          <div className="space-y-3">
            {itemTargets.length > 1 && (
              <div className="space-y-1"><Label htmlFor="ci-target">List</Label>
                <select id="ci-target" className="w-full rounded-md border bg-background p-2 text-sm" value={target.z} onChange={(e) => { setTargetZ(e.target.value); setValues({}); }}>
                  {itemTargets.map((t) => <option key={t.z} value={t.z}>{t.z.split(':').slice(2).join(':')}</option>)}
                </select></div>
            )}
            {!header.data?.event && <p className="text-xs text-muted-foreground">No header found for this list on the relays; using a plain name field.</p>}
            {schema?.fields.map((f) => (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={`ci-${f.name}`}>{f.name}{f.level === 'required' ? <span className="text-destructive"> *</span> : <span className="text-muted-foreground"> ({f.level === 'recommended' ? 'recommended' : 'optional'})</span>}</Label>
                {f.name === 'p' ? (
                  values.p ? (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span className="font-medium">{whoName}</span><Button size="sm" variant="ghost" onClick={() => { set('p', ''); setWho(''); }}>change</Button></div>
                  ) : (
                    <>
                      <Input id={`ci-${f.name}`} value={who} onChange={(e) => setWho(e.target.value)} placeholder="npub… or search by name" />
                      {who.trim().length >= 2 && (
                        <ul className="max-h-40 overflow-y-auto rounded-md border text-sm">
                          {whoSearch.isLoading && <li className="p-2 text-muted-foreground">Searching…</li>}
                          {(whoSearch.data ?? []).map((h) => { const name = h.metadata.display_name || h.metadata.name || genUserName(h.pubkey); return (
                            <li key={h.pubkey}><button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted" onClick={() => { set('p', h.pubkey); setWhoName(name); }}>
                              {h.metadata.picture && <img src={h.metadata.picture} alt="" className="h-6 w-6 rounded-full object-cover" />}<span className="font-medium">{name}</span>{h.metadata.nip05 && <span className="truncate text-xs text-muted-foreground">{h.metadata.nip05}</span>}
                            </button></li>); })}
                        </ul>
                      )}
                    </>
                  )
                ) : f.type === 'textarea' || f.name === 'description'
                  ? <Textarea id={`ci-${f.name}`} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.description ?? f.name} />
                  : <Input id={`ci-${f.name}`} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.description ?? f.name} />}
              </div>
            ))}
            {extraOptional.map((k) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={`ci-${k}`}>{k} <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea id={`ci-${k}`} value={values[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder="Notes about this item" />
              </div>
            ))}
            {isInsider && <p className="text-xs text-muted-foreground">You are the patron or purser: your own items never earn from this campaign.</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={isPending || !schema} onClick={submit}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish {schema?.singular ?? 'item'}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
