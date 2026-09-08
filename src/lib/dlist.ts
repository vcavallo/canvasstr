/** Build a kind-39999 DList item for a list-item campaign target (Tapestry base NIP shape). */
import type { EventTemplate } from './gleaner';

export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'item';
}

export interface DlistItemInput {
  /** `39998:<pk>:<d>` header coordinate. */
  target: string;
  name: string;
  description?: string;
  /** Optional payload tag: p (pubkey), e (event id), a (coordinate), t (topic). */
  payload?: { tag: 'p' | 'e' | 'a' | 't'; value: string };
  /** Disambiguates the d-tag per contributor list; defaults to a short suffix of the name hash. */
  suffix?: string;
}

export function buildDlistItemTemplate(input: DlistItemInput): EventTemplate {
  const name = input.name.trim();
  if (!name) throw new Error('name is required');
  const d = input.suffix ? `${slugify(name)}-${input.suffix}` : slugify(name);
  const tags: string[][] = [['d', d], ['z', input.target], ['name', name]];
  if (input.description?.trim()) tags.push(['description', input.description.trim()]);
  if (input.payload?.value.trim()) tags.push([input.payload.tag, input.payload.value.trim()]);
  return { kind: 39999, content: '', tags };
}
