/**
 * "What do contributors add?" — the human-level intent behind a campaign target. Maps to
 * Tapestry mechanisms (tag elements, DList headers, per-tag tagging headers) so users never
 * have to pick "tag" vs "list" themselves.
 */
import type { HeaderSchema } from './dlist';
import type { CampaignTarget } from './gleaner';

export type Intent = 'people' | 'things' | 'notes';

export const INTENTS: { id: Intent; label: string; blurb: string }[] = [
  { id: 'people', label: 'People', blurb: 'Contributors tag or add nostr profiles. Example: podcasters, developers, people to follow.' },
  { id: 'things', label: 'Things on a list', blurb: 'Contributors add items with fields. Example: restaurants in Toronto, GitHub accounts, songs.' },
  { id: 'notes', label: 'Notes or events', blurb: 'Contributors tag existing notes. Example: great threads about X, memes, bug reports.' },
];

/** A DList whose items are pubkeys (header requires or allows a `p` payload). */
export function isPeopleList(schema: HeaderSchema): boolean {
  return schema.fields.some((f) => f.name === 'p');
}

export interface TargetOption {
  target: CampaignTarget;
  /** Short name for the chip. */
  name: string;
  /** Plain-words description of what a contribution is. */
  what: string;
  description?: string;
  /** Author of the tag element / list header, for lens ranking. */
  author: string;
  mechanism: 'tag' | 'list' | 'tagging-header';
}

export function tagToPeopleOption(t: { coord: string; id: string; pubkey: string; slug: string; name: string; description?: string; relay: string }): TargetOption {
  return { target: { z: t.coord, relay: t.relay, hint: 'profile-tag', tagEventId: t.id }, name: t.name, what: `People tagged "${t.slug}"`, description: t.description, author: t.pubkey, mechanism: 'tag' };
}

export function tagToNotesOption(t: { pubkey: string; slug: string; name: string; description?: string; relay: string }): TargetOption {
  return { target: { z: `39999:${t.pubkey}:tagging:${t.slug}-tagging`, relay: t.relay, hint: 'event-tag' }, name: t.name, what: `Notes tagged "${t.slug}"`, description: t.description, author: t.pubkey, mechanism: 'tagging-header' };
}

export function listToOption(h: { coord: string; pubkey: string; plural: string; description?: string; relay: string }, schema: HeaderSchema): TargetOption {
  const people = isPeopleList(schema);
  const fields = schema.fields.map((f) => f.name).filter((n) => n !== 'p').join(', ');
  return {
    target: { z: h.coord, relay: h.relay, hint: 'item' }, name: h.plural, author: h.pubkey, mechanism: 'list', description: h.description,
    what: people ? `A list of ${h.plural.toLowerCase()}: one profile per item${fields ? ` (${fields})` : ''}` : `A list of ${h.plural.toLowerCase()}: one item with ${fields || 'a name'}`,
  };
}

/** Which options an intent admits. */
export function optionMatchesIntent(o: TargetOption, intent: Intent, schema?: HeaderSchema): boolean {
  if (intent === 'people') return o.mechanism === 'tag' || (o.mechanism === 'list' && !!schema && isPeopleList(schema));
  if (intent === 'notes') return o.mechanism === 'tagging-header';
  return o.mechanism === 'list' && (!schema || !isPeopleList(schema));
}
