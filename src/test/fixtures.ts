import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NostrEvent } from '@nostrify/nostrify';

/** Load a JSONL fixture pulled off the Brainstorm relays with `nak` (see test/fixtures/). */
export function loadFixture(name: string): NostrEvent[] {
  const path = resolve(__dirname, '../../test/fixtures', name);
  return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as NostrEvent);
}

/** Minimal signed-looking event for builders' output. */
export function asEvent(t: { kind: number; content: string; tags: string[][] }, pubkey: string, created_at = 1_700_000_000, id?: string): NostrEvent {
  return { ...t, pubkey, created_at, id: id ?? `${pubkey.slice(0, 8)}-${created_at}-${t.kind}`, sig: '' } as NostrEvent;
}
