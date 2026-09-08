import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDlistHeaders } from '@/hooks/useDlistHeaders';
import { classifyTarget } from '@/lib/contributions';
import type { CampaignTarget } from '@/lib/gleaner';

const COORD = /^(39998|39999):[0-9a-f]{64}:.+$/;

/**
 * Pick campaign targets: search DList headers on the list relays, or paste any
 * `39998:<pk>:<d>` / `39999:<pk>:<d>` coordinate (tagging headers, tag concepts…).
 */
export function TargetPicker({ value, onChange, relays }: { value: CampaignTarget[]; onChange: (t: CampaignTarget[]) => void; relays: string[] }) {
  const [search, setSearch] = useState('');
  const { headers, isLoading } = useDlistHeaders(relays, search);
  const pasted = COORD.test(search.trim());

  const add = (t: CampaignTarget) => {
    if (value.some((v) => v.z === t.z)) return;
    onChange([...value, t]);
    setSearch('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((t) => (
          <Badge key={t.z} variant="secondary" className="gap-1 font-mono text-xs">
            {t.z.split(':').slice(2).join(':')}
            <button type="button" aria-label={`Remove ${t.z}`} onClick={() => onChange(value.filter((v) => v.z !== t.z))}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
        {value.length === 0 && <span className="text-sm text-muted-foreground">No targets yet.</span>}
      </div>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lists by name, or paste a 39998:… coordinate" />
      {pasted && (
        <Button type="button" size="sm" variant="outline" onClick={() => add({ z: search.trim(), hint: classifyTarget(search.trim()) })}>
          Add coordinate ({classifyTarget(search.trim())})
        </Button>
      )}
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
