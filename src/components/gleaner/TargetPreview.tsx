import { AuthorAvatar } from '@/components/AuthorAvatar';
import { AuthorName } from '@/components/AuthorName';
import { useDlistHeader } from '@/hooks/useDlistHeader';
import { useTargetPreview } from '@/hooks/useTargetPreview';
import { isTagElementTarget } from '@/lib/contributions';
import type { CampaignTarget } from '@/lib/gleaner';

/** What the board will look like for this target: a few existing entries, or the shape of one. */
export function TargetPreview({ target, relays }: { target: CampaignTarget; relays: string[] }) {
  const preview = useTargetPreview(target, relays, 5);
  const isTag = isTagElementTarget(target);
  const isNotes = target.hint === 'event-tag';
  const header = useDlistHeader(!isTag && !isNotes ? target.z : undefined, [...new Set([...(target.relay ? [target.relay] : []), ...relays])]);
  const slug = target.z.split(':').slice(2).join(':').replace(/^tagging:|-tagging$/g, '');
  const shape = isTag ? `someone tags a profile as "${slug}"` : isNotes ? `someone tags a note as "${slug}"` : header.data ? `an item with ${header.data.schema.fields.map((f) => f.name + (f.level === 'required' ? '*' : '')).join(', ')}` : 'an item';

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <p className="mb-1"><span className="text-muted-foreground">A contribution is:</span> {shape}</p>
      {preview.isLoading && <p className="text-muted-foreground">Loading existing entries…</p>}
      {preview.data && preview.data.total === 0 && <p className="text-muted-foreground">Nothing has been added here yet. The board starts empty.</p>}
      {preview.data && preview.data.total > 0 && (
        <>
          <p className="text-muted-foreground">Latest of {preview.data.total}{preview.data.more ? '+' : ''} existing entries:</p>
          <ul className="mt-1 space-y-1">
            {preview.data.items.map((c) => (
              <li key={c.ref} className="flex items-center gap-2">
                <AuthorAvatar pubkey={c.pubkey} className="h-4 w-4" relays={relays} /><AuthorName pubkey={c.pubkey} relays={relays} className="text-muted-foreground" />
                {c.kindOfContribution === 'profile-tag' && c.taggedRef
                  ? <>tagged <AuthorAvatar pubkey={c.taggedRef} className="h-4 w-4" relays={relays} /><AuthorName pubkey={c.taggedRef} relays={relays} className="font-medium" /></>
                  : <span className="truncate">{c.label}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
