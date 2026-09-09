import { describe, expect, it } from 'vitest';
import { isPeopleList, listToOption, optionMatchesIntent, tagToNotesOption, tagToPeopleOption } from './intent';
import { parseHeaderSchema } from './dlist';
import { loadFixture } from '@/test/fixtures';

const headers = loadFixture('headers.jsonl');
const github = headers.find((e) => e.tags.some(([n, v]) => n === 'd' && v === 'github-accounts'))!;
const dwarf = headers.find((e) => e.tags.some(([n, v]) => n === 'required' && v === 'p'))!;
const tag = { coord: '39999:' + 'a'.repeat(64) + ':podcaster', id: 'b'.repeat(64), pubkey: 'a'.repeat(64), slug: 'podcaster', name: 'Podcaster', relay: 'wss://r' };

describe('intent', () => {
  it('classifies people lists by a p field', () => {
    expect(isPeopleList(parseHeaderSchema(github))).toBe(false);
    expect(isPeopleList(parseHeaderSchema(dwarf))).toBe(true);
  });
  it('describes options in plain words and routes them by intent', () => {
    const people = tagToPeopleOption(tag);
    expect(people.what).toBe('People tagged "podcaster"');
    expect(people.target).toMatchObject({ hint: 'profile-tag', tagEventId: 'b'.repeat(64) });
    const notes = tagToNotesOption(tag);
    expect(notes.target.z).toBe(`39999:${'a'.repeat(64)}:tagging:podcaster-tagging`);
    const gh = listToOption({ coord: 'x', pubkey: 'a'.repeat(64), plural: 'GitHub Accounts', relay: 'wss://r' }, parseHeaderSchema(github));
    expect(gh.what).toBe('A list of github accounts: one item with github-username');
    expect(optionMatchesIntent(people, 'people')).toBe(true);
    expect(optionMatchesIntent(people, 'things')).toBe(false);
    expect(optionMatchesIntent(notes, 'notes')).toBe(true);
    expect(optionMatchesIntent(gh, 'things', parseHeaderSchema(github))).toBe(true);
    expect(optionMatchesIntent(gh, 'people', parseHeaderSchema(github))).toBe(false);
  });
});
