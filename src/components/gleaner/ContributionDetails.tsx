import { nip19 } from 'nostr-tools';
import { AuthorName } from '@/components/AuthorName';
import type { Contribution } from '@/lib/contributions';

function Value({ name, value, relays }: { name: string; value: string; relays?: string[] }) {
  if (name === 'p' && /^[0-9a-f]{64}$/.test(value)) return <AuthorName pubkey={value} relays={relays} />;
  if (/^https?:\/\//.test(value)) return <a className="underline break-all" href={value} target="_blank" rel="noreferrer">{value}</a>;
  return <span className="break-words">{value}</span>;
}

/**
 * Everything the contributor actually submitted: every descriptive tag on the item plus the
 * payload (`p`/`e`/`a`/`t`) and content. The arbiter judges this, so it is never hidden.
 */
export function ContributionDetails({ contribution: c, relays }: { contribution: Contribution; relays?: string[] }) {
  const payload = c.event.tags.find(([n]) => ['p', 'e', 'a', 't'].includes(n));
  const rows: [string, string][] = [...c.fields];
  if (payload && c.kindOfContribution === 'item') rows.push([payload[0], payload[1]]);
  if (c.kindOfContribution !== 'item' && c.taggedRef) rows.push(['target', c.taggedRef]);
  const content = c.event.content?.trim();
  if (rows.length === 0 && !content) return null;
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pl-9 text-sm">
      {rows.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{k === 'e' || k === 'a' ? <code className="text-xs">{k === 'e' ? nip19.noteEncode(v).slice(0, 20) + '…' : v}</code> : <Value name={k} value={v} relays={relays} />}</dd>
        </div>
      ))}
      {content && !rows.some(([, v]) => v === content) && <><dt className="text-muted-foreground">content</dt><dd className="whitespace-pre-wrap break-words">{content.slice(0, 500)}</dd></>}
    </dl>
  );
}
