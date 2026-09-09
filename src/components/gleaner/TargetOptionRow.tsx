import { AuthorName } from '@/components/AuthorName';
import { Badge } from '@/components/ui/badge';
import { useTargetPreview } from '@/hooks/useTargetPreview';
import type { TargetOption } from '@/lib/intent';
import type { Score } from '@/lib/pov';
import { RankBadge } from './RankBadge';

/** One search result: plain-words description, author rank under the lens, lazy count. */
export function TargetOptionRow({ option: o, score, relays, onPick, unranked }: { option: TargetOption; score?: Score; relays: string[]; onPick: () => void; unranked?: boolean }) {
  const preview = useTargetPreview(o.target, relays, 1);
  const count = preview.data ? `${preview.data.total}${preview.data.more ? '+' : ''} so far` : preview.isLoading ? '…' : '';
  return (
    <li>
      <button type="button" className="flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left hover:bg-muted" onClick={onPick}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{o.name}</span>
          <Badge variant="outline" className="text-xs">{o.mechanism === 'list' ? 'list' : 'tag'}</Badge>
          <span className="text-xs text-muted-foreground">{count}</span>
        </span>
        <span className="text-sm text-muted-foreground">{o.what}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          by <AuthorName pubkey={o.author} /> <RankBadge score={score} unranked={unranked} />
          {o.description && <span className="line-clamp-1">· {o.description}</span>}
        </span>
      </button>
    </li>
  );
}
