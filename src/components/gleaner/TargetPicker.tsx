import { useMemo, useState } from 'react';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDlistHeaders } from '@/hooks/useDlistHeaders';
import { useLens, useRanks } from '@/hooks/useLens';
import { useTagElements } from '@/hooks/useTagElements';
import { parseHeaderSchema } from '@/lib/dlist';
import type { CampaignTarget } from '@/lib/gleaner';
import { INTENTS, listToOption, optionMatchesIntent, tagToNotesOption, tagToPeopleOption, type Intent, type TargetOption } from '@/lib/intent';
import { passesLens } from '@/lib/pov';
import { TargetOptionRow } from './TargetOptionRow';
import { TargetPreview } from './TargetPreview';

const COORD = /^(39998|39999):[0-9a-f]{64}:.+$/;
const TAG_URL = /\/tag\/[^/]+\/([0-9a-f]{64})|^([0-9a-f]{64})$/;
const TAG_RELAYS = ['wss://tags.brainstorm.world/relay'];

/**
 * Intent first ("what do contributors add?"), then a scoped search whose results say in
 * plain words what a contribution is, ranked under the viewer's lens, with a preview of
 * existing entries once picked. Coordinates and tag URLs can still be pasted.
 */
export function TargetPicker({ value, onChange, relays }: { value: CampaignTarget[]; onChange: (t: CampaignTarget[]) => void; relays: string[] }) {
  const { nostr } = useNostr();
  const { lens, minRank } = useLens();
  const [intent, setIntent] = useState<Intent | undefined>();
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const { headers, isLoading: listsLoading } = useDlistHeaders(relays, search);
  const { tags, isLoading: tagsLoading } = useTagElements(TAG_RELAYS, search);
  const trimmed = search.trim();
  const pastedCoord = COORD.test(trimmed);
  const tagMatch = trimmed.match(TAG_URL);
  const tagId = tagMatch?.[1] ?? tagMatch?.[2];

  const options = useMemo<TargetOption[]>(() => {
    if (!intent) return [];
    const out: TargetOption[] = [];
    for (const t of tags) {
      if (intent === 'people') out.push(tagToPeopleOption(t));
      if (intent === 'notes') out.push(tagToNotesOption(t));
    }
    for (const h of headers) {
      const schema = parseHeaderSchema(h.event, h.d);
      const o = listToOption(h, schema);
      if (optionMatchesIntent(o, intent, schema)) out.push(o);
    }
    return out;
  }, [intent, tags, headers]);

  const ranks = useRanks(lens, useMemo(() => options.map((o) => o.author), [options]));
  const scores = ranks.data;
  const unranked = lens.source === 'author';
  const sorted = useMemo(() => [...options].sort((a, b) => (scores?.get(b.author)?.rank ?? 0) - (scores?.get(a.author)?.rank ?? 0) || a.name.localeCompare(b.name)), [options, scores]);
  const visible = showAll || !scores || unranked ? sorted : sorted.filter((o) => passesLens(scores, o.author, minRank));
  const hidden = sorted.length - visible.length;

  const add = (t: CampaignTarget) => { if (!value.some((v) => v.z === t.z)) onChange([...value, t]); setSearch(''); };

  const addTagById = async () => {
    setResolving(true); setError('');
    try {
      const filter = tagId ? { ids: [tagId] } : (() => { const [, pk, ...rest] = trimmed.split(':'); return { kinds: [39999], authors: [pk], '#d': [rest.join(':')] }; })();
      const events = await nostr.query([filter], { signal: AbortSignal.timeout(8000), relays: [...new Set([...TAG_RELAYS, ...relays])] });
      const tag: NostrEvent | undefined = events.sort((a, b) => b.created_at - a.created_at)[0];
      if (!tag || tag.kind !== 39999 || !tag.tags.some(([n, v]) => n === 'z' && /:tag$/.test(v))) throw new Error('That is not a tag on the tag relay.');
      const slug = tag.tags.find(([n]) => n === 'd')?.[1] ?? '';
      const base = { coord: `39999:${tag.pubkey}:${slug}`, id: tag.id, pubkey: tag.pubkey, slug, name: slug, relay: TAG_RELAYS[0] };
      add(intent === 'notes' ? tagToNotesOption(base).target : tagToPeopleOption(base).target);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setResolving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>What do contributors add?</Label>
        <RadioGroup value={intent ?? ''} onValueChange={(v) => { setIntent(v as Intent); setSearch(''); setShowAll(false); }} className="grid gap-2 sm:grid-cols-3">
          {INTENTS.map((i) => (
            <label key={i.id} htmlFor={`intent-${i.id}`} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 ${intent === i.id ? 'border-primary bg-muted/40' : ''}`}>
              <RadioGroupItem id={`intent-${i.id}`} value={i.id} className="mt-0.5" />
              <span><span className="font-medium">{i.label}</span><br /><span className="text-xs text-muted-foreground">{i.blurb}</span></span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="flex flex-wrap gap-1">
        {value.map((t) => (
          <Badge key={t.z} variant="secondary" className="gap-1 font-mono text-xs" title={t.z}>
            {t.hint === 'profile-tag' && t.tagEventId ? 'people tagged ' : t.hint === 'event-tag' ? 'notes tagged ' : 'list '}{t.z.split(':').slice(2).join(':').replace(/^tagging:|-tagging$/g, '')}
            <button type="button" aria-label={`Remove ${t.z}`} onClick={() => onChange(value.filter((v) => v.z !== t.z))}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>

      {intent && (
        <>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={intent === 'people' ? 'Search tags and people-lists, or paste a tag URL' : intent === 'notes' ? 'Search tags, or paste a tag URL' : 'Search lists by name, or paste a 39998:… coordinate'} />
          {(tagId || (pastedCoord && trimmed.startsWith('39999:') && intent !== 'things')) && (
            <Button type="button" size="sm" variant="outline" disabled={resolving} onClick={addTagById}>{resolving ? 'Resolving…' : intent === 'notes' ? 'Use this tag (notes tagged with it count)' : 'Use this tag (people tagged with it count)'}</Button>
          )}
          {pastedCoord && trimmed.startsWith('39998:') && (
            <Button type="button" size="sm" variant="outline" onClick={() => add({ z: trimmed, hint: 'item' })}>Use this list coordinate</Button>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {search && !pastedCoord && !tagId && (
            <ul className="max-h-72 overflow-y-auto rounded-md border text-sm divide-y">
              {(listsLoading || tagsLoading) && <li className="p-2 text-muted-foreground">Searching…</li>}
              {!listsLoading && !tagsLoading && visible.length === 0 && <li className="p-2 text-muted-foreground">{hidden > 0 ? `Only results below your min rank (${hidden}).` : 'Nothing matches.'}</li>}
              {visible.map((o) => <TargetOptionRow key={o.target.z} option={o} score={scores?.get(o.author)} relays={relays} unranked={unranked} onPick={() => add(o.target)} />)}
              {hidden > 0 && !showAll && <li className="p-2"><button type="button" className="text-xs underline" onClick={() => setShowAll(true)}>Show {hidden} more below your min rank</button></li>}
            </ul>
          )}
        </>
      )}

      {value.map((t) => <TargetPreview key={t.z} target={t} relays={relays} />)}
    </div>
  );
}
