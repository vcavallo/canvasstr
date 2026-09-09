import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { Info } from 'lucide-react';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { AuthorName } from '@/components/AuthorName';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Contribution } from '@/lib/contributions';

const INLINE_FIELDS = 2;

function Value({ name, value, relays }: { name: string; value: string; relays?: string[] }) {
  if (name === 'p' && /^[0-9a-f]{64}$/.test(value)) return <span className="inline-flex items-center gap-1"><AuthorAvatar pubkey={value} className="h-4 w-4" relays={relays} /><AuthorName pubkey={value} relays={relays} /></span>;
  if (name === 'e') return <code className="text-xs">{nip19.noteEncode(value)}</code>;
  if (name === 'a') return <code className="text-xs break-all">{value}</code>;
  if (/^https?:\/\//.test(value)) return <a className="underline break-all" href={value} target="_blank" rel="noreferrer">{value}</a>;
  return <span className="whitespace-pre-wrap break-words">{value}</span>;
}

/** Every descriptive tag, then the payload / tagged target. */
function rowsFor(c: Contribution): [string, string][] {
  const rows: [string, string][] = [...c.fields];
  const payload = c.event.tags.find(([n]) => ['p', 'e', 'a', 't'].includes(n));
  if (payload && c.kindOfContribution === 'item') rows.push([payload[0], payload[1]]);
  if (c.kindOfContribution !== 'item' && c.taggedRef) rows.push(['target', c.taggedRef]);
  return rows;
}

function Fields({ rows, relays, className }: { rows: [string, string][]; relays?: string[]; className?: string }) {
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm ${className ?? ''}`}>
      {rows.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0"><Value name={k} value={v} relays={relays} /></dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * What the contributor submitted. Inline: the first couple of fields, so the board stays
 * scannable. "Details" opens everything — all fields, content, target, contributor, time,
 * coordinate and the raw event — for anyone (voters need it as much as the purser).
 */
export function ContributionDetails({ contribution: c, relays }: { contribution: Contribution; relays?: string[] }) {
  const [open, setOpen] = useState(false);
  const rows = rowsFor(c);
  const content = c.event.content?.trim();
  const hasMore = rows.length > INLINE_FIELDS || !!content;
  const when = new Date(c.created_at * 1000);
  return (
    <div className="mt-1 flex items-start gap-3 pl-9">
      {rows.length > 0 && <Fields rows={rows.slice(0, INLINE_FIELDS)} relays={relays} className="min-w-0 flex-1 [&_dd]:truncate" />}
      <Button size="sm" variant="ghost" className="h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground" onClick={() => setOpen(true)}>
        <Info className="h-3.5 w-3.5" />{hasMore ? `Details (+${rows.length - INLINE_FIELDS + (content ? 1 : 0)})` : 'Details'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="break-words">{c.label}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <AuthorAvatar pubkey={c.pubkey} className="h-5 w-5" relays={relays} /><AuthorName pubkey={c.pubkey} relays={relays} />
              <span>· {c.kindOfContribution === 'item' ? 'list item' : c.kindOfContribution === 'event-tag' ? 'event tagging' : 'profile tagging'}</span>
              <time dateTime={when.toISOString()} title="Author-claimed time">· {when.toLocaleString()}</time>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {rows.length > 0 ? <Fields rows={rows} relays={relays} /> : <p className="text-sm text-muted-foreground">No fields on this event.</p>}
            {content && <div><p className="text-xs text-muted-foreground">content</p><p className="whitespace-pre-wrap break-words text-sm">{content}</p></div>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <dt>coordinate</dt><dd><code className="break-all">{c.ref}</code></dd>
              <dt>event</dt><dd><code className="break-all">{nip19.neventEncode({ id: c.id, author: c.pubkey, kind: c.kind })}</code></dd>
              <dt>target</dt><dd><code className="break-all">{c.target}</code></dd>
            </dl>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Raw event</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-2">{JSON.stringify(c.event, null, 2)}</pre>
            </details>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
