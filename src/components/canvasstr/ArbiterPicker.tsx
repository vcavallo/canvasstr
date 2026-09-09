import { AuthorName } from '@/components/AuthorName';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useArbiterAnnouncements } from '@/hooks/useCatallax';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toHexPubkey } from '@/lib/lensConfig';
import { RankBadge } from './RankBadge';
import { BecomeArbiterDialog } from './BecomeArbiterDialog';
import type { Score } from '@/lib/pov';

export interface ArbiterChoice { pubkey: string; service?: string }

/** Self, any announced purser (33400) sorted by lens rank, or a pasted npub. Never restricted. */
export function ArbiterPicker({ value, onChange, scores }: { value?: ArbiterChoice; onChange: (a: ArbiterChoice | undefined) => void; scores: Map<string, Score> }) {
  const { user } = useCurrentUser();
  const { data: pursers = [] } = useArbiterAnnouncements();
  const sorted = [...pursers].sort((a, b) => (scores.get(b.arbiterPubkey)?.rank ?? 0) - (scores.get(a.arbiterPubkey)?.rank ?? 0));
  const selectedKey = value ? `${value.pubkey}:${value.service ?? ''}` : '';

  return (
    <div className="space-y-2">
      <RadioGroup value={selectedKey} onValueChange={(k) => { const [pubkey, ...rest] = k.split(':'); onChange({ pubkey, service: rest.join(':') || undefined }); }}>
        {user && (
          <div className="flex items-center gap-2">
            <RadioGroupItem id="arb-self" value={`${user.pubkey}:`} />
            <Label htmlFor="arb-self">Myself (self-arbitrated)</Label>
          </div>
        )}
        {sorted.map((a) => (
          <div key={a.id} className="flex items-center gap-2">
            <RadioGroupItem id={`arb-${a.id}`} value={`${a.arbiterPubkey}:33400:${a.arbiterPubkey}:${a.d}`} />
            <Label htmlFor={`arb-${a.id}`} className="flex items-center gap-2">
              <AuthorName pubkey={a.arbiterPubkey} /> <span className="text-muted-foreground">{a.content.name}</span>
              <RankBadge score={scores.get(a.arbiterPubkey)} />
            </Label>
          </div>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground">Anyone can arbitrate; only announced pursers are listed. <BecomeArbiterDialog compact /></p>
      <Input placeholder="or paste a purser npub…" onChange={(e) => { const hex = toHexPubkey(e.target.value); if (hex) onChange({ pubkey: hex }); }} />
      {value && <p className="text-xs text-muted-foreground">Purser: <AuthorName pubkey={value.pubkey} /></p>}
    </div>
  );
}
