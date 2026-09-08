import { useState } from 'react';
import { Eye, UserSearch, X } from 'lucide-react';
import { AuthorName } from '@/components/AuthorName';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useLens } from '@/hooks/useLens';
import { toHexPubkey } from '@/lib/lensConfig';

const SOURCE_LABEL: Record<string, string> = {
  url: 'shared point of view', self: 'your point of view', default: 'default point of view', house: 'house point of view', author: 'author view',
};

/** Who you are looking through, the min-rank threshold, and the author-view escape hatch. */
export function LensBar() {
  const { lens, minRank, setMinRank, selfPov, author, setAuthor, env } = useLens();
  const [draft, setDraft] = useState('');
  const invalid = draft.length > 0 && !toHexPubkey(draft);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-muted-foreground" />
        {lens.source === 'author' && lens.author ? (
          <>
            <span>Viewing everything by <AuthorName pubkey={lens.author} className="font-medium" /></span>
            <Badge variant="outline">unranked</Badge>
            <Button size="sm" variant="ghost" onClick={() => setAuthor(undefined)} aria-label="Leave author view"><X className="h-4 w-4" /></Button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">{SOURCE_LABEL[lens.source]}</span>
            {lens.observer && <AuthorName pubkey={lens.observer} className="font-medium" />}
            {!lens.provider && <Badge variant="destructive">no scores available</Badge>}
          </>
        )}
      </div>

      {lens.source !== 'author' && (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">min rank</span>
          <Slider className="w-32" min={0} max={100} step={1} value={[minRank]} onValueChange={([v]) => setMinRank(v)} />
          <span className="w-8 tabular-nums">{minRank}</span>
        </div>
      )}

      {lens.source !== 'author' && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); if (!invalid && draft) { setAuthor(draft); setDraft(''); } }}
        >
          <UserSearch className="h-4 w-4 text-muted-foreground" />
          <Input
            className={`h-8 w-64 ${invalid ? 'border-destructive' : ''}`}
            placeholder="view as author: npub…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="View everything by an author"
          />
        </form>
      )}

      {selfPov === 'missing' && !author && (
        <a className="text-primary underline" href={env.brainstormSignup} target="_blank" rel="noreferrer">
          Create your point of view on Brainstorm
        </a>
      )}
      {selfPov === 'ready' && lens.source !== 'self' && lens.source !== 'author' && (
        <span className="text-muted-foreground">(your own POV is ready; clear ?pov to use it)</span>
      )}
    </div>
  );
}
