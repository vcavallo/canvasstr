/**
 * DList header schemas and item construction (Tapestry decentralized-lists NIP).
 * A kind-39998 header declares which tags an item must/may carry via
 * `required` / `recommended` / `allowed` / `disallowed` tags (one tag name each,
 * optional human description as the third element) plus optional `field-type` hints.
 */
import type { NostrEvent } from '@nostrify/nostrify';
import type { EventTemplate } from './canvasstr';

export type FieldLevel = 'required' | 'recommended' | 'allowed';
export interface HeaderField { name: string; level: FieldLevel; description?: string; type?: string }
export interface HeaderSchema {
  singular: string;
  plural: string;
  description?: string;
  fields: HeaderField[];
  disallowed: string[];
}

/** Standard optional item tags every list accepts (base NIP). */
export const STANDARD_OPTIONAL = ['description'];
/** Tags that are structure, never user-entered data. */
export const STRUCTURAL_TAGS = new Set(['d', 'z', 'n', 's', 'b', 'json', 'polarity', 'alt', 'client', 'published_at', 'concept-graph']);

export function parseHeaderSchema(header: NostrEvent | null | undefined, fallbackName = 'item'): HeaderSchema {
  const names = header?.tags.find(([n]) => n === 'names');
  const types = new Map((header?.tags ?? []).filter(([n]) => n === 'field-type').map(([, f, t]) => [f, t]));
  const fields: HeaderField[] = [];
  const seen = new Set<string>();
  for (const level of ['required', 'recommended', 'allowed'] as FieldLevel[]) {
    for (const [n, field, description] of header?.tags ?? []) {
      if (n !== level || !field || seen.has(field)) continue;
      seen.add(field);
      fields.push({ name: field, level, description: description || undefined, type: types.get(field) });
    }
  }
  if (fields.length === 0) fields.push({ name: 'name', level: 'required', type: 'text' });
  const disallowed = (header?.tags ?? []).filter(([n]) => n === 'disallowed').map(([, f]) => f);
  return {
    singular: names?.[1] ?? fallbackName, plural: names?.[2] ?? names?.[1] ?? fallbackName,
    description: header?.tags.find(([n]) => n === 'description')?.[1], fields, disallowed,
  };
}

export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'item';
}

export interface DlistItemInput {
  /** `39998:<pk>:<d>` header coordinate. */
  target: string;
  /** Tag name → value, per the header's schema (plus `description`). */
  fields: Record<string, string>;
  schema: HeaderSchema;
  /** Random-ish suffix so two contributors' items never share a `d` by accident. */
  suffix?: string;
}

/** Validate against the schema and build the kind-39999 item. */
export function buildDlistItemTemplate(input: DlistItemInput): EventTemplate {
  const values = Object.fromEntries(Object.entries(input.fields).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  for (const f of input.schema.fields) if (f.level === 'required' && !values[f.name]) throw new Error(`${f.name} is required`);
  for (const k of Object.keys(values)) if (input.schema.disallowed.includes(k)) throw new Error(`${k} is not allowed on this list`);
  const primary = input.schema.fields[0]?.name;
  const label = values[primary] ?? values.name ?? Object.values(values)[0] ?? 'item';
  const d = input.suffix ? `${slugify(label)}-${input.suffix}` : slugify(label);
  const tags: string[][] = [['d', d], ['z', input.target]];
  for (const f of input.schema.fields) if (values[f.name]) tags.push([f.name, values[f.name]]);
  for (const k of STANDARD_OPTIONAL) if (values[k] && !input.schema.fields.some((f) => f.name === k)) tags.push([k, values[k]]);
  return { kind: 39999, content: '', tags };
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
