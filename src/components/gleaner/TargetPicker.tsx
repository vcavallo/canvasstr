import { useState } from 'react';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDlistHeaders } from '@/hooks/useDlistHeaders';
import { classifyTarget } from '@/lib/contributions';
import type { CampaignTarget } from '@/lib/gleaner';

const COORD = /^(39998|39999):[0-9a-f]{64}:.+$/;
/** tags.brainstorm.world/tag/<slug>/<tag-event-id> or a bare 64-hex tag event id. */
const TAG_URL = /\/tag\/[^/]+\/([0-9a-f]{64})|^([0-9a-f]{64})$/;
const TAG_RELAYS = ['wss://tags.brainstorm.world/relay'];

/**
 * Pick campaign targets: search DList headers on the list relays, or paste any
 * `39998:<pk>:<d>` / `39999:<pk>:<d>` coordinate (tagging headers, tag concepts…).
 */
export function TargetPicker({ value, onChange, relays }: { value: CampaignTarget[]; onChange: (t: CampaignTarget[]) => void; relays: string[] }) {
  const [search, setSearch] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const { nostr } = useNostr();
  const { headers, isLoading } = useDlistHeaders(relays, search);
  const trimmed = search.trim();
  const pasted = COORD.test(trimmed);
  const tagMatch = trimmed.match(TAG_URL);
  const tagId = tagMatch?.[1] ?? tagMatch?.[2];
  /** Resolve a tag element (by id, or by 39999 coordinate) into a profile-tag target. */
  const addTag = async () => {
    setResolving(true); setResolveError('');
    try {
      const filter = tagId ? { ids: [tagId] } : (() => { const [, pk, ...rest] = trimmed.split(':'); return { kinds: [39999], authors: [pk], '#d': [rest.join(':')] }; })();
      const events = await nostr.query([filter], { signal: AbortSignal.timeout(8000), relays: [...new Set([...TAG_RELAYS, ...relays])] });
      const tag: NostrEvent | undefined = events.sort((a, b) => b.created_at - a.created_at)[0];
      if (!tag || tag.kind !== 39999 || !tag.tags.some(([n, v]) => n === 'z' && /:tag$/.test(v))) throw new Error('That is not a tag element on the tag relay.');
      const d = tag.tags.find(([n]) => n === 'd')?.[1] ?? '';
      add({ z: `39999:${tag.pubkey}:${d}`, relay: TAG_RELAYS[0], hint: 'profile-tag', tagEventId: tag.id });
    } catch (e) { setResolveError(e instanceof Error ? e.message : String(e)); }
    finally { setResolving(false); }
  };

  const add = (t: CampaignTarget) => {
    if (value.some((v) => v.z === t.z)) return;
    onChange([...value, t]);
    setSearch('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((t) => (
          <Badge key={t.z} variant="secondary" className="gap-1 font-mono text-xs" title={t.z}>
            {t.hint === 'profile-tag' && t.tagEventId ? 'tag: ' : ''}{t.z.split(':').slice(2).join(':')}
            <button type="button" aria-label={`Remove ${t.z}`} onClick={() => onChange(value.filter((v) => v.z !== t.z))}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
        {value.length === 0 && <span className="text-sm text-muted-foreground">No targets yet.</span>}
      </div>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lists by name, paste a coordinate, or paste a tags.brainstorm.world/tag/… URL" />
      {tagId && (
        <Button type="button" size="sm" variant="outline" disabled={resolving} onClick={addTag}>{resolving ? 'Resolving tag…' : 'Add tag (profiles tagged with it count)'}</Button>
      )}
      {pasted && !tagId && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => add({ z: trimmed, hint: classifyTarget(trimmed) })}>
            Add coordinate as a list/header ({classifyTarget(trimmed)})
          </Button>
          {trimmed.startsWith('39999:') && !/:tagging:/.test(trimmed) && (
            <Button type="button" size="sm" variant="outline" disabled={resolving} onClick={addTag}>{resolving ? 'Resolving tag…' : 'Add as a tag (profiles tagged with it count)'}</Button>
          )}
        </div>
      )}
      {resolveError && <p className="text-sm text-destructive">{resolveError}</p>}
      {search && !pasted && (
        <ul className="max-h-48 overflow-y-auto rounded-md border text-sm">
          {isLoading && <li className="p-2 text-muted-foreground">Searching…</li>}
          {!isLoading && headers.length === 0 && <li className="p-2 text-muted-foreground">No lists match.</li>}
          {headers.map((h) => (
            <li key={h.coord}>
              <button type="button" className="flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left hover:bg-muted" onClick={() => add({ z: h.coord, relay: h.relay, hint: 'item' })}>
                <span className="font-medium">{h.plural}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{h.description ?? h.coord}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
