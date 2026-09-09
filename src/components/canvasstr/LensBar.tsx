import { useState } from 'react';
import { Eye, UserSearch, X } from 'lucide-react';
import { AuthorName } from '@/components/AuthorName';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useLens } from '@/hooks/useLens';
import { useBrainstormAccount } from '@/hooks/useBrainstorm';
import { Loader2 } from 'lucide-react';
import { toHexPubkey } from '@/lib/lensConfig';

/** The threshold slider confuses more than it helps right now; state and default (1) stay. */
const SHOW_MIN_RANK = false;

const SOURCE_LABEL: Record<string, string> = {
  url: 'shared point of view', self: 'your point of view', default: 'default point of view', house: 'house point of view', author: 'author view',
};

/** Who you are looking through, the min-rank threshold, and the author-view escape hatch. */
export function LensBar() {
  const { lens, minRank, setMinRank, selfPov, author, setAuthor } = useLens();
  const bs = useBrainstormAccount();
  // /user/history can lag behind the actual calculation; the lens readiness probe (stats graperank-pov) is authoritative.
  const povReady = selfPov === 'ready';
  const state = povReady && (bs.state === 'computing' || bs.state === 'none' || bs.state === 'unknown') ? 'ready' : bs.state;
  const hasMap = povReady && lens.source === 'self' && lens.via === 'relay';
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
            {lens.via === 'http' && <Badge variant="outline" title="Scores read from api.brainstorm.world for this observer">via Brainstorm</Badge>}
            {!lens.provider && !lens.observer && <Badge variant="destructive">no scores available</Badge>}
          </>
        )}
      </div>

      {SHOW_MIN_RANK && lens.source !== 'author' && (
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

      {state === 'failed' && <span className="text-destructive">Brainstorm could not compute a point of view for this key (a key with no follows has no web of trust).</span>}
      {selfPov === 'missing' && !author && state !== 'computing' && state !== 'ready' && (
        <Button size="sm" variant="outline" disabled={bs.state === 'busy'} onClick={() => void bs.createPov()} title="Signs a login challenge with your key and asks Brainstorm to compute GrapeRank from your point of view">
          {state === 'busy' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{state === 'failed' ? 'Try again' : 'Create my point of view'}
        </Button>
      )}
      {state === 'computing' && <span className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Brainstorm is computing your point of view (a few minutes; this checks every minute)</span>}
      {state === 'ready' && !hasMap && !author && (
        <span className="flex flex-wrap items-center gap-2 text-muted-foreground">Your point of view is ready. Last step, one signature:
          <Button size="sm" variant="outline" disabled={bs.state === 'busy'} onClick={() => void bs.publishTreasureMap()} title="Publishes your kind-10040 Treasure Map so any app (Canvasstr included) knows where your scores live. Same as Brainstorm's 'Activate your account' step.">
            {bs.state === 'busy' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Activate: publish my Treasure Map
          </Button>
        </span>
      )}
      {bs.error && <span className="text-destructive">{bs.error}</span>}
      {selfPov === 'ready' && lens.source !== 'self' && lens.source !== 'author' && (
        <span className="text-muted-foreground">(your own POV is ready; clear ?pov to use it)</span>
      )}
    </div>
  );
}
