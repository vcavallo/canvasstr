import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

/** Tag concept namespaces we know: the canonical legacy literal (ADR 0015) and the tags-branch TA. */
const TAG_CONCEPTS = ['39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag', '39998:a68dbf561cfe3da1b76f1e65c7d4d9cc116f79921b38a815fd75cb5460b4b599:tag'];

export interface TagElement { coord: string; id: string; pubkey: string; slug: string; name: string; description?: string; relay: string; event: NostrEvent }

export function parseTagElement(e: NostrEvent, relay: string): TagElement | null {
  if (e.kind !== 39999 || !e.tags.some(([n, v]) => n === 'z' && /:tag$/.test(v))) return null;
  const slug = e.tags.find(([n]) => n === 'd')?.[1];
  if (!slug) return null;
  let name = slug, description: string | undefined;
  try { const c = JSON.parse(e.content) as { tag?: { name?: string; description?: string } }; name = c.tag?.name ?? slug; description = c.tag?.description; } catch { /* slug only */ }
  return { coord: `${e.kind}:${e.pubkey}:${slug}`, id: e.id, pubkey: e.pubkey, slug, name, description, relay, event: e };
}

/** Tag elements (lexicon entries) on the tag relays, latest per coordinate, searchable client-side. */
export function useTagElements(relays: string[], search: string) {
  const { nostr } = useNostr();
  const needle = search.trim().toLowerCase();
  // The relays are full of test tags; an exact-slug `#d` query guarantees the real one is found.
  const exact = useQuery<TagElement[]>({
    queryKey: ['tag-elements', 'exact', relays, needle],
    enabled: needle.length > 1,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const slugs = [...new Set([needle, needle.replace(/\s+/g, '-'), needle.replace(/s$/, ''), needle + 's'])];
      const out: TagElement[] = [];
      await Promise.all(relays.map(async (relay) => {
        const events = await nostr.query([{ kinds: [39999], '#z': TAG_CONCEPTS, '#d': slugs, limit: 50 }], { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), relays: [relay] }).catch(() => [] as NostrEvent[]);
        for (const e of events) { const x = parseTagElement(e, relay); if (x) out.push(x); }
      }));
      return out;
    },
  });
  const q = useQuery<TagElement[]>({
    queryKey: ['tag-elements', relays],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const out = new Map<string, TagElement>();
      await Promise.all(relays.map(async (relay) => {
        const events = await nostr.query([{ kinds: [39999], '#z': TAG_CONCEPTS, limit: 3000 }], { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), relays: [relay] }).catch(() => [] as NostrEvent[]);
        for (const e of events) {
          const t = parseTagElement(e, relay);
          if (!t) continue;
          const prev = out.get(t.coord);
          if (!prev || e.created_at > prev.event.created_at) out.set(t.coord, t);
        }
      }));
      return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  const filtered = useMemo(() => {
    const byCoord = new Map<string, TagElement>();
    for (const x of [...(exact.data ?? []), ...(q.data ?? [])]) { const prev = byCoord.get(x.coord); if (!prev || x.event.created_at > prev.event.created_at) byCoord.set(x.coord, x); }
    const all = [...byCoord.values()];
    if (!needle) return all.slice(0, 30);
    const hits = all.filter((t) => [t.slug, t.name, t.description ?? ''].some((s) => s.toLowerCase().includes(needle)));
    const score = (x: TagElement) => (x.slug.toLowerCase() === needle || x.name.toLowerCase() === needle ? 0 : x.slug.toLowerCase().startsWith(needle) ? 1 : 2);
    return hits.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name)).slice(0, 30);
  }, [q.data, exact.data, needle]);
  return { tags: filtered, isLoading: q.isLoading || (needle.length > 1 && exact.isLoading) };
}
